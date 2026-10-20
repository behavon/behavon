import { describe, expect, it } from "vitest";
import Behave from "behavon";
import type { Signal, Slot, StateSetter, UntypedModelRef } from "behavon";
import { inspectSnapshotChannelForTests } from "../../src/internal/snapshot-channels";
import { uniqueChannel, waitFor } from "../helpers";

function captureThrown(trigger: () => void): unknown {
  try {
    trigger();
  } catch (reason: unknown) {
    return reason;
  }
  throw new Error("Expected a synchronous failure");
}

async function captureScheduledFailure(trigger: () => void): Promise<unknown> {
  let surfaced: unknown;
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
    try {
      if (typeof handler === "function") handler();
    } catch (error: unknown) {
      surfaced = error;
    }
    return originalSetTimeout(() => undefined, 0);
  }) as typeof setTimeout;
  try {
    trigger();
    await Promise.resolve();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  return surfaced;
}

function captureUnhandledRejection(trigger: () => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      process.off("unhandledRejection", onUnhandledRejection);
      reject(new Error("Expected an unhandled rejection"));
    }, 1_000);
    const onUnhandledRejection = (reason: unknown): void => {
      setImmediate(() => {
        clearTimeout(timeout);
        process.off("unhandledRejection", onUnhandledRejection);
        resolve(reason);
      });
    };
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      trigger();
    } catch (error: unknown) {
      clearTimeout(timeout);
      process.off("unhandledRejection", onUnhandledRejection);
      reject(error);
    }
  });
}

describe("user-code failure boundaries", () => {
  it("B02 preserves a lazy state initializer failure and aborts construction", () => {
    const failure = new Error("lazy state initializer failed");
    let modelCompleted = false;

    function Broken(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- initializer-failure probe throws before a state handle can be consumed
      Behave.useState(() => {
        throw failure;
      });
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      modelCompleted = true;
      return undefined;
    }

    expect(captureThrown(() => Behave.createModel(Broken, undefined))).toBe(failure);
    expect(modelCompleted).toBe(false);
  });

  it("B03 preserves a state updater failure without activating the failed evaluation", async () => {
    interface Endpoints {
      readonly fail: Signal;
    }
    const failure = { boundary: "state updater" };
    let evaluations = 0;

    function Model(): undefined {
      const [, setValue] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      const failBody = Behave.useCallback(() => {
        setValue(() => {
          throw failure;
        });
      }, [setValue]);
      Behave.useSignal("fail", failBody);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.fail())).toBe(failure);
    expect(evaluations).toBe(1);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("B04 preserves a Model input updater failure without reevaluating the target", async () => {
    const failure = new Error("Child input updater failed");
    let childEvaluations = 0;
    let setInput: StateSetter<number> | undefined;

    function Child(_input: number): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      childEvaluations += 1;
      return undefined;
    }

    const child = Behave.createModel(Child, 1);
    function Observer(): undefined {
      const [, setter] = Behave.useModel(child);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setInput = setter;
      return undefined;
    }

    const observer = Behave.createModel(Observer, undefined);
    observer.dispose();
    expect(await captureScheduledFailure(() => setInput?.(() => {
      throw failure;
    }))).toBe(failure);
    expect(childEvaluations).toBe(1);
    expect(() => Behave.getInterface(child)).toThrow(/disposed/);
  });

  it("B05 preserves a memo factory failure and the latest successful endpoint registry", async () => {
    interface Endpoints {
      readonly fail: Signal;
      readonly stable: Signal;
    }
    const failure = new Error("memo factory failed");
    let stableCalls = 0;

    function Model(): undefined {
      const [shouldFail, setShouldFail] = Behave.useState(false);
      // eslint-disable-next-line behavon-hooks/canonical-api -- memo-failure probe needs the factory invocation, not its value
      Behave.useMemo(() => {
        if (shouldFail) throw failure;
        return 1;
      }, [shouldFail]);
      const failBody = Behave.useCallback(() => setShouldFail(true), [setShouldFail]);
      Behave.useSignal("fail", failBody);
      const stableBody = Behave.useCallback(() => {
        stableCalls += 1;
      }, []);
      Behave.useSignal("stable", stableBody);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.fail())).toBe(failure);
    expect(stableCalls).toBe(0);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("B06 preserves a dependency-list Proxy accessor failure", async () => {
    interface Endpoints {
      readonly fail: Signal;
    }
    const failure = new Error("dependency length failed");

    function Model(): undefined {
      const [shouldFail, setShouldFail] = Behave.useState(false);
      const dependencies = shouldFail
        ? new Proxy([] as unknown[], {
          get(target, property, receiver) {
            if (property === "length") throw failure;
            return Reflect.get(target, property, receiver);
          },
        })
        : [];
      // eslint-disable-next-line behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- test-only dependency-access failure probe requires a dynamic dependency object
      Behave.useMemo(() => 1, dependencies);
      const failBody = Behave.useCallback(() => setShouldFail(true), [setShouldFail]);
      Behave.useSignal("fail", failBody);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.fail())).toBe(failure);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("B06 preserves dependency-list every and index accessor failures", async () => {
    interface Endpoints {
      readonly reevaluate: Signal;
    }
    const everyFailure = new Error("dependency every failed");
    const indexFailure = new Error("dependency index failed");
    const everyDependencies = new Proxy([0], {
      get(target, property, receiver) {
        if (property === "every") throw everyFailure;
        return Reflect.get(target, property, receiver);
      },
    });

    function createBrokenRoot(mode: "every" | "index"): UntypedModelRef {
      function Model(): undefined {
        const [epoch, setEpoch] = Behave.useState(0);
        const initial = mode === "every" ? everyDependencies : [0];
        const next = mode === "index" && epoch > 0
          ? new Proxy([0], {
            get(target, property, receiver) {
              if (property === "0") throw indexFailure;
              return Reflect.get(target, property, receiver);
            },
          })
          : initial;
        // eslint-disable-next-line behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- test-only dependency-access failure probe requires a dynamic dependency object
        Behave.useMemo(() => 1, next);
        const reevaluateBody = Behave.useCallback(() => {
          setEpoch((value) => value + 1);
        }, [setEpoch]);
        Behave.useSignal("reevaluate", reevaluateBody);
        return undefined;
      }
      return Behave.createModel(Model, undefined);
    }

    const everyRoot = createBrokenRoot("every");
    expect(await captureScheduledFailure(() => everyRoot.reevaluate())).toBe(everyFailure);
    expect(() => Behave.getInterface(everyRoot)).toThrow(/disposed/);

    const indexRoot = createBrokenRoot("index");
    expect(await captureScheduledFailure(() => indexRoot.reevaluate())).toBe(indexFailure);
    expect(() => Behave.getInterface(indexRoot)).toThrow(/disposed/);
  });

  it("B06 preserves a custom dependency every method failure", async () => {
    interface Endpoints {
      readonly reevaluate: Signal;
    }
    const failure = new Error("custom dependency every method failed");
    const dependencies = {
      0: 0,
      length: 1,
      every() {
        throw failure;
      },
    } as unknown as readonly unknown[];

    function Model(): undefined {
      const [, setEpoch] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- test-only dependency-method failure probe requires a dynamic dependency object
      Behave.useMemo(() => 1, dependencies);
      const reevaluateBody = Behave.useCallback(() => {
        setEpoch((value) => value + 1);
      }, [setEpoch]);
      Behave.useSignal("reevaluate", reevaluateBody);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.reevaluate())).toBe(failure);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("B07 preserves a primitive thrown by an ordinary managed callback", () => {
    const failure = Symbol("ordinary callback failure");
    let callback: (() => void) | undefined;

    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callback = Behave.useCallback(() => {
        throw failure;
      }, []);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(captureThrown(() => callback?.())).toBe(failure);
    root.dispose();
  });

  it("B08 surfaces an async Signal body rejection through the host with its original reason", async () => {
    interface Endpoints {
      readonly fire: Signal;
    }
    const failure = { boundary: "async Signal body" };

    function Model(): undefined {
      const fireBody = Behave.useCallback(() => Promise.reject(failure), []);
      Behave.useSignal("fire", fireBody);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureUnhandledRejection(() => root.fire())).toBe(failure);
    root.dispose();
  });

  it("B11 turns a Slot then getter throw into a host rejection without stopping a sibling", async () => {
    const failure = new Error("then getter failed");
    let direct: Slot | undefined;
    let getterCalls = 0;
    let siblingCalls = 0;

    function Model(): undefined {
      const receiveBody = Behave.useCallback(() => Object.defineProperty({}, "then", {
        get(): never {
          getterCalls += 1;
          throw failure;
        },
      }), []);
      const siblingBody = Behave.useCallback(() => {
        siblingCalls += 1;
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      direct = Behave.useSlot("receive", receiveBody);
      Behave.useSlot("receive", siblingBody);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    let returned: unknown;
    expect(await captureUnhandledRejection(() => {
      returned = direct?.();
    })).toBe(failure);
    expect(returned).toBeUndefined();
    expect(getterCalls).toBe(1);
    expect(siblingCalls).toBe(1);
    root.dispose();
  });

  it("B14 preserves an initial effect setup failure and releases runtime-owned state", () => {
    const channel = uniqueChannel("effect-setup-failure");
    const failure = new Error("effect setup failed");

    function Broken(): undefined {
      Behave.useSnapshot(channel);
      Behave.useEffect(() => {
        throw failure;
      }, []);
      return undefined;
    }

    expect(captureThrown(() => Behave.createModel(Broken, undefined))).toBe(failure);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("B15 preserves an initial external-store getSnapshot failure without subscribing", () => {
    const failure = new Error("evaluation getSnapshot failed");
    let subscribeCalls = 0;

    function Broken(): undefined {
      Behave.useSyncExternalStore(
        () => {
          subscribeCalls += 1;
          return () => undefined;
        },
        () => {
          throw failure;
        },
      );
      return undefined;
    }

    expect(captureThrown(() => Behave.createModel(Broken, undefined))).toBe(failure);
    expect(subscribeCalls).toBe(0);
  });

  it("B15 preserves an active external-store evaluation read failure", async () => {
    interface Endpoints {
      readonly reevaluate: Signal;
    }
    const failure = new Error("active getSnapshot failed");
    let shouldFail = false;

    function Model(): undefined {
      const [, setEpoch] = Behave.useState(0);
      Behave.useSyncExternalStore(
        () => () => undefined,
        () => {
          if (shouldFail) throw failure;
          return 0;
        },
      );
      const reevaluateBody = Behave.useCallback(() => {
        setEpoch((value) => value + 1);
      }, [setEpoch]);
      Behave.useSignal("reevaluate", reevaluateBody);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    shouldFail = true;
    expect(await captureScheduledFailure(() => root.reevaluate())).toBe(failure);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("B16 preserves an initial external-store subscribe failure", () => {
    const failure = new Error("initial subscribe failed");

    function Broken(): undefined {
      Behave.useSyncExternalStore(
        () => {
          throw failure;
        },
        () => 0,
      );
      return undefined;
    }

    expect(captureThrown(() => Behave.createModel(Broken, undefined))).toBe(failure);
  });

  it("B17 keeps an initial subscription when the post-subscribe changed-check fails", async () => {
    const failure = new Error("post-subscribe getSnapshot failed");
    let reads = 0;
    let subscribeCalls = 0;
    let unsubscribeCalls = 0;
    const subscribeStore = (): (() => void) => {
      subscribeCalls += 1;
      return () => {
        unsubscribeCalls += 1;
      };
    };

    function Broken(): undefined {
      Behave.useSyncExternalStore(
        subscribeStore,
        () => {
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
          reads += 1;
          if (reads === 2) throw failure;
          return 0;
        },
      );
      return undefined;
    }

    const root = Behave.createModel(Broken, undefined);
    await waitFor(() => reads >= 3);
    expect(subscribeCalls).toBe(1);
    expect(unsubscribeCalls).toBe(0);
    root.dispose();
    expect(unsubscribeCalls).toBe(1);
  });

  it("B18 schedules evaluation after a store-listener changed-check failure", async () => {
    const failure = new Error("listener getSnapshot failed");
    let current = 0;
    let shouldFail = false;
    let listener: (() => void) | undefined;
    const observed: number[] = [];

    function Model(): undefined {
      const value = Behave.useSyncExternalStore(
        (nextListener) => {
          listener = nextListener;
          return () => {
            listener = undefined;
          };
        },
        () => {
          if (shouldFail) throw failure;
          return current;
        },
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      observed.push(value);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    shouldFail = true;
    expect(() => listener?.()).not.toThrow();
    shouldFail = false;
    current = 1;
    await waitFor(() => observed.at(-1) === 1);
    expect(observed).toEqual([0, 1]);
    root.dispose();
  });

  it("B20 completes terminal disposal when external-store unsubscribe throws", () => {
    const channel = uniqueChannel("unsubscribe-dispose-failure");
    const failure = new Error("unsubscribe failed");

    function Model(): undefined {
      Behave.useSyncExternalStore(
        () => () => {
          throw failure;
        },
        () => 0,
      );
      Behave.useSnapshot(channel);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(captureThrown(() => root.dispose())).toBe(failure);
    expect(() => Behave.getInterface(root as UntypedModelRef)).toThrow(/disposed/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("B22 preserves a Boundary Child cleanup failure and completes runtime-owned disposal", () => {
    const childChannel = uniqueChannel("nested-child-cleanup-failure");
    const failure = new Error("nested Child unsubscribe failed");

    function Child(): undefined {
      Behave.useSyncExternalStore(
        () => () => {
          throw failure;
        },
        () => 0,
      );
      Behave.useSnapshot(childChannel);
      return undefined;
    }

    const root = Behave.createModel(Behave.boundary(Child), undefined);
    expect(captureThrown(() => root.dispose())).toBe(failure);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
    expect(inspectSnapshotChannelForTests(childChannel)).toBeUndefined();
  });

  it("B01 aborts a failed Child construction and releases its provisional owner", () => {
    const channel = uniqueChannel("failed-child-construction");
    const failure = new Error("Child construction failed");

    function BrokenChild(): never {
      Behave.useSnapshot(channel);
      throw failure;
    }

    expect(captureThrown(() => Behave.createModel(BrokenChild, undefined))).toBe(failure);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("B01 terminates an active target after its public input setter triggers reevaluation failure", async () => {
    interface ChildEndpoints {
      readonly ping: Signal;
    }
    const failure = new Error("active Child reevaluation failed");
    let pingCalls = 0;
    const observedStates: number[] = [];
    let setInput: StateSetter<number> | undefined;

    function Child(input: number): undefined {
      const [state] = Behave.useState(7);
      const pingBody = Behave.useCallback(() => {
        pingCalls += 1;
        observedStates.push(state);
      }, [state]);
      Behave.useSignal("ping", pingBody);
      if (input === 2) throw failure;
      return undefined;
    }

    const child = Behave.createModel(Child, 1);
    function Observer(): undefined {
      const [, setter] = Behave.useModel(child);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setInput = setter;
      return undefined;
    }

    const observer = Behave.createModel(Observer, undefined);
    observer.dispose();
    expect(await captureScheduledFailure(() => setInput?.(2))).toBe(failure);
    expect(() => Behave.getInterface(child)).toThrow(/disposed/);
    expect(() => child.ping()).toThrow(/disposed/);
    expect(pingCalls).toBe(0);
    expect(observedStates).toEqual([]);
  });

  it("B22 preserves a primary activation failure across throwing rollback cleanup", () => {
    const channel = uniqueChannel("primary-activation-failure");
    const primary = new Error("primary activation failed");
    const cleanupFailure = new Error("rollback cleanup failed");
    let cleanupCalls = 0;

    function Broken(): undefined {
      Behave.useSnapshot(channel);
      Behave.useEffect(() => () => {
        cleanupCalls += 1;
        throw cleanupFailure;
      }, []);
      Behave.useEffect(() => {
        throw primary;
      }, []);
      return undefined;
    }

    const surfaced = captureThrown(() => Behave.createModel(Broken, undefined));
    expect(surfaced).toBeInstanceOf(AggregateError);
    expect((surfaced as AggregateError).errors).toEqual([primary, cleanupFailure]);
    expect(cleanupCalls).toBe(1);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });
});
