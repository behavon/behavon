import { describe, expect, it } from "vitest";
import Behave from "behavon";
import type { UntypedModelRef, Signal, Slot, StateSetter } from "behavon";
import { uniqueChannel, waitFor, waitForSnapshot } from "../helpers";

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function captureScheduledFailure(run: () => void, afterCapture?: () => void): Promise<unknown> {
  const originalSetTimeout = globalThis.setTimeout;
  let surfaced: unknown;
  globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
    try {
      if (typeof handler === "function") handler();
    } catch (error: unknown) {
      surfaced = error;
      afterCapture?.();
    }
    return originalSetTimeout(() => undefined, 0);
  }) as typeof setTimeout;
  try {
    run();
    await Promise.resolve();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  return surfaced;
}

describe("Object.is update bailout", () => {
  it("S01-S03 S05 S09 consumes same value, updater, batch, multi-cell, and same-object prefixes without activation", async () => {
    interface Endpoints {
      readonly update: Signal<readonly [mode: string]>;
    }
    const shared = { value: 1 };
    let setups = 0;
    let cleanups = 0;
    let updaterCalls = 0;

    function Model(): undefined {
      const [left, setLeft] = Behave.useState(1);
      const [right, setRight] = Behave.useState(shared);
      const update = Behave.useCallback((mode: string) => {
        if (mode === "value") setLeft(1);
        if (mode === "updater") setLeft((previous) => {
          updaterCalls += 1;
          return previous;
        });
        if (mode === "batch") {
          setLeft(2);
          setLeft(1);
        }
        if (mode === "multi") {
          setLeft(1);
          setRight(shared);
        }
        if (mode === "object") setRight(shared);
      }, [setLeft, setRight]);
      Behave.useSignal("update", update);
      Behave.useEffect(() => {
        setups += 1;
        return () => {
          cleanups += 1;
        };
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only Object.is probe intentionally allocates a fresh object dependency
      }, [{ left, right }]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect({ setups, cleanups }).toEqual({ setups: 1, cleanups: 0 });
    for (const mode of ["value", "updater", "batch", "multi", "object"]) {
      root.update(mode);
      await settle();
      expect({ setups, cleanups }).toEqual({ setups: 1, cleanups: 0 });
    }
    expect(updaterCalls).toBe(1);
    root.dispose();
    expect(cleanups).toBe(1);
  });

  it("S04 S06 commits one transition when any queued state has a changed final value", async () => {
    interface Endpoints {
      readonly change: Signal;
    }
    const values: Array<readonly [number, number]> = [];
    let setups = 0;
    let cleanups = 0;

    function Model(): undefined {
      const [left, setLeft] = Behave.useState(0);
      const [right, setRight] = Behave.useState(0);
      const change = Behave.useCallback(() => {
        setLeft(1);
        setLeft(0);
        setRight((previous) => previous + 1);
      }, [setLeft, setRight]);
      Behave.useSignal("change", change);
      Behave.useEffect(() => {
        setups += 1;
        values.push([left, right]);
        return () => {
          cleanups += 1;
        };
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only Object.is probe intentionally allocates a fresh object dependency
      }, [{ left, right }]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    root.change();
    await waitFor(() => values.length === 2);
    expect(values).toEqual([[0, 0], [0, 1]]);
    expect({ setups, cleanups }).toEqual({ setups: 2, cleanups: 1 });
    await settle();
    expect(values).toHaveLength(2);
    root.dispose();
  });

  it("S07-S08 treats NaN as equal and signed zero as different", async () => {
    interface Endpoints {
      readonly sameNaN: Signal;
      readonly negativeZero: Signal;
    }
    const committed: number[] = [];
    let setups = 0;

    function Model(): undefined {
      const [value, setValue] = Behave.useState(Number.NaN);
      const sameNaNBody = Behave.useCallback(() => setValue(Number.NaN), [setValue]);
      Behave.useSignal("sameNaN", sameNaNBody);
      const negativeZeroBody = Behave.useCallback(() => setValue(-0), [setValue]);
      Behave.useSignal("negativeZero", negativeZeroBody);
      Behave.useEffect(() => {
        setups += 1;
        committed.push(value);
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only Object.is probe intentionally wraps the captured value in a fresh object dependency
      }, [{ value }]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    root.sameNaN();
    await settle();
    expect(setups).toBe(1);
    root.negativeZero();
    await waitFor(() => setups === 2);
    expect(Object.is(committed[1], -0)).toBe(true);
    root.dispose();
  });

  it("S10 commits a structurally equal object with a new identity", async () => {
    interface Endpoints {
      readonly replace: Signal;
    }
    const committed: object[] = [];
    function Model(): undefined {
      const [value, setValue] = Behave.useState({ value: 1 });
      const replaceBody = Behave.useCallback(() => setValue({ value: 1 }), [setValue]);
      Behave.useSignal("replace", replaceBody);
      Behave.useEffect(() => {
        committed.push(value);
      }, [value]);
      return undefined;
    }
    const root = Behave.createModel(Model, undefined);
    root.replace();
    await waitFor(() => committed.length === 2);
    expect(committed[1]).not.toBe(committed[0]);
    root.dispose();
  });

  it("S11 preserves updater throw identity, order, atomicity, and the existing retained-prefix policy", async () => {
    interface Endpoints {
      readonly fail: Signal;
    }
    const failure = new Error("state updater failed");
    const order: string[] = [];
    let committed = 0;

    function Model(): undefined {
      const [value, setValue] = Behave.useState(0);
      const failBody = Behave.useCallback(() => {
        setValue(() => {
          order.push("first");
          return 1;
        });
        setValue(() => {
          order.push("throw");
          throw failure;
        });
        setValue(() => {
          order.push("later");
          return 2;
        });
      }, [setValue]);
      Behave.useSignal("fail", failBody);
      Behave.useEffect(() => {
        committed = value;
      }, [value]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.fail())).toBe(failure);
    expect(order).toEqual(["first", "throw"]);
    expect(committed).toBe(0);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("S12 E25 preserves suffix updates enqueued by an updater without loss or duplication", async () => {
    interface Endpoints {
      readonly update: Signal;
    }
    const committed: Array<readonly [number, number]> = [];
    let outerCalls = 0;
    let suffixCalls = 0;

    function Model(): undefined {
      const [right, setRight] = Behave.useState(0);
      const [left, setLeft] = Behave.useState(0);
      const updateBody = Behave.useCallback(() => {
        setLeft((previous) => {
          outerCalls += 1;
          setLeft((suffixPrevious) => {
            suffixCalls += 1;
            return suffixPrevious + 1;
          });
          setRight((suffixPrevious) => suffixPrevious + 1);
          return previous;
        });
      }, [setLeft, setRight]);
      Behave.useSignal("update", updateBody);
      Behave.useEffect(() => {
        committed.push([left, right]);
      }, [left, right]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    root.update();
    await waitFor(() => committed.length === 2);
    expect(committed).toEqual([[0, 0], [1, 1]]);
    expect({ outerCalls, suffixCalls }).toEqual({ outerCalls: 1, suffixCalls: 1 });
    await settle();
    expect(committed).toHaveLength(2);
    root.dispose();
  });

  it("M21 preserves Model input updater failure identity before terminal target cleanup", async () => {
    const failure = new Error("input updater failed");
    let childEvaluations = 0;
    let laterCalls = 0;
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
    expect(await captureScheduledFailure(() => {
      setInput?.(() => {
        throw failure;
      });
      setInput?.(() => {
        laterCalls += 1;
        return 2;
      });
    })).toBe(failure);
    expect(childEvaluations).toBe(1);
    expect(laterCalls).toBe(0);
    expect(() => Behave.getInterface(child)).toThrow(/disposed/);
  });

  it("E23 performs the initial commit but bails out a same update queued during construction", async () => {
    let queued = false;
    let activations = 0;
    function Model(): undefined {
      const [value, setValue] = Behave.useState(0);
      if (!queued) {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        queued = true;
        setValue(value);
      }
      Behave.useEffect(() => {
        activations += 1;
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only Object.is probe intentionally allocates a fresh object dependency
      }, [{}]);
      return undefined;
    }
    const root = Behave.createModel(Model, undefined);
    await settle();
    expect(activations).toBe(1);
    root.dispose();
  });

  it("E24 commits a real change and bails out its evaluation-time same-value follow-up", async () => {
    interface Endpoints {
      readonly change: Signal;
    }
    const committed: number[] = [];
    let followUpQueued = false;
    function Model(): undefined {
      const [value, setValue] = Behave.useState(0);
      if (value === 1 && !followUpQueued) {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        followUpQueued = true;
        setValue(1);
      }
      const changeBody = Behave.useCallback(() => setValue(1), [setValue]);
      Behave.useSignal("change", changeBody);
      Behave.useEffect(() => {
        committed.push(value);
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only Object.is probe intentionally wraps the captured value in a fresh object dependency
      }, [{ value }]);
      return undefined;
    }
    const root = Behave.createModel(Model, undefined);
    root.change();
    await waitFor(() => committed.length === 2);
    expect(committed).toEqual([0, 1]);
    await settle();
    expect(committed).toEqual([0, 1]);
    root.dispose();
  });

  it("E26 keeps updater enqueue/throw identity and terminal owner disposal semantics", async () => {
    interface Endpoints {
      readonly fail: Signal;
      readonly terminate: Signal;
    }
    const failure = new Error("updater failure");
    let root: UntypedModelRef;
    let setValue: StateSetter<number> | undefined;

    function Model(): undefined {
      const [, setter] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setValue = setter;
      const failBody = Behave.useCallback(() => setter(() => {
        setter(1);
        throw failure;
      }), [setter]);
      Behave.useSignal("fail", failBody);
      const terminateBody = Behave.useCallback(() => setter((previous) => {
        setter(2);
        root.dispose();
        return previous;
      }), [setter]);
      Behave.useSignal("terminate", terminateBody);
      return undefined;
    }

    root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.fail())).toBe(failure);
    expect(() => setValue?.(3)).not.toThrow();

    root = Behave.createModel(Model, undefined);
    const terminalFailure = await captureScheduledFailure(() => root.terminate());
    expect(String(terminalFailure)).toMatch(/disposed during evaluation.*cannot be committed/);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
    expect(() => setValue?.(3)).not.toThrow();
  });

  it("C27-C29 leaves speculative effect, memo, callback, endpoint, and external-store identities inactive", async () => {
    interface Endpoints {
      readonly speculate: Signal;
      readonly inspect: Signal;
    }
    let phase = 0;
    let effectSetups = 0;
    let effectCleanups = 0;
    let subscribeCalls = 0;
    let unsubscribeCalls = 0;
    const callbackPhases: number[] = [];

    function Model(): undefined {
      const [value, setValue] = Behave.useState(0);
      const renderedPhase = phase;
      const memoPhase = Behave.useMemo(() => renderedPhase, [renderedPhase]);
      const inspect = Behave.useCallback(() => callbackPhases.push(memoPhase), [memoPhase]);
      Behave.useSignal("inspect", inspect);
      const speculateBody = Behave.useCallback(() => setValue((previous) => {
        phase = 1;
        return previous;
      }), [setValue]);
      Behave.useSignal("speculate", speculateBody);
      const subscribe = (_listener: () => void) => {
        subscribeCalls += 1;
        return () => {
          unsubscribeCalls += 1;
        };
      };
      const getSnapshot = () => {
        return phase;
      };
      Behave.useSyncExternalStore(subscribe, getSnapshot);
      Behave.useEffect(() => {
        effectSetups += 1;
        return () => {
          effectCleanups += 1;
        };
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only candidate identity probe intentionally uses a freshly allocated dependency object
      }, [{ value, renderedPhase }]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    root.speculate();
    await settle();
    expect({ effectSetups, effectCleanups, subscribeCalls, unsubscribeCalls }).toEqual({
      effectSetups: 1,
      effectCleanups: 0,
      subscribeCalls: 1,
      unsubscribeCalls: 0,
    });
    root.inspect();
    expect(callbackPhases).toEqual([0]);
    root.dispose();
    expect(unsubscribeCalls).toBe(1);
  });

  it("C29 does not publish speculative Model output as the latest committed Child output", async () => {
    interface ChildEndpoints { readonly speculate: Signal; }
    interface ParentEndpoints { readonly inspect: Signal; }
    let phase = 0;
    const observedOutputs: number[] = [];

    function Child(): number {
      const [, setValue] = Behave.useState(0);
      const renderedPhase = phase;
      const speculateBody = Behave.useCallback(() => setValue((previous) => {
        phase = 1;
        return previous;
      }), [setValue]);
      Behave.useSignal("speculate", speculateBody);
      return renderedPhase;
    }
    const child = Behave.createModel(Child, undefined);
    function Parent(): undefined {
      const [epoch, setEpoch] = Behave.useState(0);
      const [output] = Behave.useModel(child);
      const inspectBody = Behave.useCallback(() => setEpoch((previous) => previous + 1), [setEpoch]);
      Behave.useSignal("inspect", inspectBody);
      Behave.useEffect(() => {
        if (output !== undefined) observedOutputs.push(output);
      }, [epoch, output]);
      return undefined;
    }

    const root = Behave.createModel(Parent, undefined);
    child.speculate();
    await settle();
    root.inspect();
    await waitFor(() => observedOutputs.length === 2);
    expect(observedOutputs).toEqual([0, 0]);
    root.dispose();
    child.dispose();
  });

  it("C30 does not activate a speculative connection retarget", async () => {
    interface SourceEndpoints { readonly fire: Signal; }
    interface SinkEndpoints { readonly receive: Slot; }
    interface ParentEndpoints { readonly speculate: Signal; }
    let target = 0;
    const deliveries: number[] = [];

    function Source(): undefined {
      const fireBody = Behave.useCallback(() => undefined, []);
      Behave.useSignal("fire", fireBody);
      return undefined;
    }
    function Sink(id: number): undefined {
      const receiveBody = Behave.useCallback(() => deliveries.push(id), [id]);
      Behave.useSlot("receive", receiveBody);
      return undefined;
    }
    const source = Behave.createModel(Source, undefined);
    const first = Behave.createModel(Sink, 1);
    const second = Behave.createModel(Sink, 2);
    function Parent(): undefined {
      const [, setValue] = Behave.useState(0);
      const sourceDependency = Behave.usePort(source);
      const sinkDependency = Behave.usePort(target === 0 ? first : second);
      Behave.useConnect(sourceDependency.fire, sinkDependency.receive);
      const speculateBody = Behave.useCallback(() => setValue((previous) => {
        target = 1;
        return previous;
      }), [setValue]);
      Behave.useSignal("speculate", speculateBody);
      return undefined;
    }

    const root = Behave.createModel(Parent, undefined);
    root.speculate();
    await settle();
    source.fire();
    expect(deliveries).toEqual([1]);
    root.dispose();
    second.dispose();
    first.dispose();
    source.dispose();
  });

  it("C32 commits a real external-store notification coalesced with a same state update", async () => {
    interface Endpoints { readonly notify: Signal; }
    let current = 0;
    let listener: (() => void) | undefined;
    const seen: number[] = [];
    const subscribe = (next: () => void) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    };
    const getSnapshot = () => current;
    function Model(): undefined {
      const [state, setState] = Behave.useState(0);
      const external = Behave.useSyncExternalStore(subscribe, getSnapshot);
      const notifyBody = Behave.useCallback(() => {
        setState(state);
        current = 1;
        listener?.();
      }, [setState, state]);
      Behave.useSignal("notify", notifyBody);
      Behave.useEffect(() => {
        seen.push(external);
      }, [external]);
      return undefined;
    }
    const root = Behave.createModel(Model, undefined);
    root.notify();
    await waitFor(() => seen.length === 2);
    expect(seen).toEqual([0, 1]);
    root.dispose();
  });

  it("C32 preserves external-store invalidation raised while a same updater is executing", async () => {
    interface Endpoints { readonly notifyDuringUpdate: Signal; }
    let current = 0;
    let listener: (() => void) | undefined;
    const committedSnapshots: number[] = [];
    const subscribe = (next: () => void) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    };
    const getSnapshot = () => current;

    function Model(): undefined {
      const [, setState] = Behave.useState(0);
      const external = Behave.useSyncExternalStore(subscribe, getSnapshot);
      const notifyDuringUpdateBody = Behave.useCallback(() => setState((previous) => {
        current = 1;
        listener?.();
        return previous;
      }), [setState]);
      Behave.useSignal("notifyDuringUpdate", notifyDuringUpdateBody);
      Behave.useEffect(() => {
        committedSnapshots.push(external);
      }, [external]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    root.notifyDuringUpdate();
    await waitFor(() => committedSnapshots.length === 2);
    expect(committedSnapshots).toEqual([0, 1]);
    root.dispose();
  });

  it("P34 keeps stale setters inert after owner disposal", async () => {
    let activations = 0;
    let setter: StateSetter<number> | undefined;
    function Model(): undefined {
      const [, setValue] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setter = setValue;
      Behave.useEffect(() => {
        activations += 1;
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only stale-setter probe intentionally allocates a fresh dependency object
      }, [{}]);
      return undefined;
    }
    const root = Behave.createModel(Model, undefined);
    root.dispose();
    expect(() => setter?.(1)).not.toThrow();
    expect(() => setter?.((previous) => previous + 1)).not.toThrow();
    await settle();
    expect(activations).toBe(1);
  });

  it("P34 makes a captured Model input setter fail fast after target disposal", () => {
    let setInput: StateSetter<number> | undefined;
    let childEvaluations = 0;
    let childCleanups = 0;
    let updaterCalls = 0;

    function Child(_input: number): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      childEvaluations += 1;
      Behave.useEffect(() => () => {
        childCleanups += 1;
      }, []);
      return undefined;
    }
    const child = Behave.createModel(Child, 1);
    function Observer(): undefined {
      const [, setter] = Behave.useModel(child);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setInput = setter;
      return undefined;
    }

    const root = Behave.createModel(Observer, undefined);
    root.dispose();
    child.dispose();
    expect(() => setInput?.(2)).toThrow(/requires a live Model instance/);
    expect(() => setInput?.((previous) => {
      updaterCalls += 1;
      return previous;
    })).toThrow(/requires a live Model instance/);
    expect({ childEvaluations, childCleanups, updaterCalls }).toEqual({
      childEvaluations: 1,
      childCleanups: 1,
      updaterCalls: 0,
    });
  });

  it("keeps completed snapshot publication independent from a same-value Model bailout", async () => {
    interface Endpoints { readonly update: Signal; }
    const channel = uniqueChannel("same-state-publication");
    let activations = 0;
    function Model(): undefined {
      const [, setValue] = Behave.useState(0);
      const [, publish] = Behave.useSnapshot(channel);
      const updateBody = Behave.useCallback(() => setValue((previous) => {
        publish(2);
        return previous;
      }), [publish, setValue]);
      Behave.useSignal("update", updateBody);
      Behave.useEffect(() => {
        activations += 1;
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only publication bailout probe intentionally allocates a fresh dependency object
      }, [{}]);
      return undefined;
    }
    const root = Behave.createModel(Model, undefined);
    root.update();
    expect(await waitForSnapshot<number>(channel, (snapshot) => snapshot === 2)).toBe(2);
    expect(activations).toBe(1);
    root.dispose();
  });
});
