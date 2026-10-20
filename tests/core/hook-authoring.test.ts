import { afterAll, describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { Signal, StateSetter, UntypedModelRef } from "behavon";
import { uniqueChannel, waitFor, signalOf } from "../helpers";

const nestedModelProbe = Behavon.createModel((input: number) => input, 0);
const nestedSnapshotProbe = Behavon.createId(Behavon.SnapshotType<unknown>());
const nestedStateProbe = Behavon.createId({ value: Behavon.StateType<unknown>() });
const nestedResourceProbe = Behavon.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});
const changedStateProbe = Behavon.createId({
  first: Behavon.StateType<number>(),
  second: Behavon.StateType<number>(),
});
const changedResourceProbeA = Behavon.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});
const changedResourceProbeB = Behavon.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});
const changedSnapshotProbeA = Behavon.createId(Behavon.SnapshotType<number>());
const changedSnapshotProbeB = Behavon.createId(Behavon.SnapshotType<number>());
afterAll(() => nestedModelProbe.dispose());

async function captureScheduledFailure(action: () => void): Promise<unknown> {
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
    action();
    await Promise.resolve();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  return surfaced;
}

function expectNestedHookFailure(failure: unknown, hook: string, boundary: string): void {
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toMatch(
    new RegExp(`^Behavon\\.${hook} cannot be called inside ${boundary} while evaluating Model#\\d+$`),
  );
}

describe("runtime-known Hook authoring boundaries", () => {
  const publicHooks: ReadonlyArray<readonly [string, () => unknown]> = [
    ["useState", () => Behavon.useState(0)],
    ["useReducer", () => Behavon.useReducer((state: number) => state, 0)],
    ["useLabelState", () => Behavon.useLabelState(nestedStateProbe.value, 0)],
    ["useMutable", () => Behavon.useMutable(0)],
    ["useMemo", () => Behavon.useMemo(() => 0, [])],
    ["useCallback", () => Behavon.useCallback(() => undefined, [])],
    ["useEffect", () => Behavon.useEffect(() => undefined, [])],
    ["useFuture", () => Behavon.useFuture(async () => undefined, { concurrency: "serial" })],
    ["useResource", () => Behavon.useResource(nestedResourceProbe, undefined)],
    ["useSyncExternalStore", () => Behavon.useSyncExternalStore(() => () => undefined, () => 0)],
    ["useSignal", () => Behavon.useSignal("nested", () => undefined)],
    ["useSlot", () => Behavon.useSlot("nested", () => undefined)],
    ["useExport", () => Behavon.useExport(() => ({ nested: true }))],
    ["useModel", () => Behavon.useModel(nestedModelProbe)],
    ["usePort", () => Behavon.usePort(undefined as never)],
    ["useConnect", () => Behavon.useConnect(undefined as never, undefined as never)],
    ["useSnapshot", () => Behavon.useSnapshot(nestedSnapshotProbe)],
  ];

  for (const [hook, invoke] of publicHooks) {
    it(`rejects ${hook} before argument processing outside Model evaluation`, () => {
      expect(invoke).toThrow(`Behavon.${hook} must be called while evaluating a Model`);
    });
  }

  for (const [hook, invoke] of publicHooks) {
    it(`rejects ${hook} before argument or resource processing inside a memo factory`, () => {
      function Model(): undefined {
        // eslint-disable-next-line behavon-hooks/canonical-api -- runtime boundary probe needs the memo factory invocation, not its value
        Behavon.useMemo(() => invoke(), []);
        return undefined;
      }

      let failure: unknown;
      try {
        Behavon.createModel(Model, undefined);
      } catch (error: unknown) {
        failure = error;
      }
      expectNestedHookFailure(failure, hook, "useMemo factory");
    });
  }

  it("rejects mounted identity changes without committing the invalid candidate", async () => {
    let useSecond = false;
    let rerender: StateSetter<number> | undefined;
    function LabeledStateModel(): number {
      const [, setTick] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const labeled = Behavon.useLabelState(
        useSecond ? changedStateProbe.second : changedStateProbe.first,
        0,
      );
      return labeled[0];
    }
    const labeledStateOwner = Behavon.createModel(LabeledStateModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: "Behavon.useLabelState StateId changed at the same Hook position",
    });
    expect(() => Behavon.getInterface(labeledStateOwner)).toThrow(/disposed/);

    useSecond = false;
    rerender = undefined;
    function ResourceModel(): string {
      const [, setTick] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const resource = Behavon.useResource(
        useSecond ? changedResourceProbeB : changedResourceProbeA,
        undefined,
      );
      return resource[0].phase;
    }
    const resourceOwner = Behavon.createModel(ResourceModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: "Behavon.useResource ResourceType changed at the same Hook position",
    });
    expect(() => Behavon.getInterface(resourceOwner)).toThrow(/disposed/);

    useSecond = false;
    rerender = undefined;
    function SignalModel(): undefined {
      const [, setTick] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const callback = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal(useSecond ? "second" : "first", callback);
      return undefined;
    }
    const signalOwner = Behavon.createModel(SignalModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: "Behavon public endpoint declaration changed from 'first' to 'second'",
    });
    expect(() => Behavon.getInterface(signalOwner)).toThrow(/disposed/);

    useSecond = false;
    rerender = undefined;
    function SlotModel(): undefined {
      const [, setTick] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const callback = Behavon.useCallback(() => undefined, []);
      Behavon.useSlot(useSecond ? "second" : "first", callback);
      return undefined;
    }
    const slotOwner = Behavon.createModel(SlotModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: "Behavon public endpoint declaration changed from 'first' to 'second'",
    });
    expect(() => Behavon.getInterface(slotOwner)).toThrow(/disposed/);

    useSecond = false;
    rerender = undefined;
    function SnapshotModel(): undefined {
      const [, setTick] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const snapshot = Behavon.useSnapshot(useSecond ? changedSnapshotProbeB : changedSnapshotProbeA);
      void snapshot;
      return undefined;
    }
    const snapshotOwner = Behavon.createModel(SnapshotModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: expect.stringMatching(/^Behavon snapshot declaration changed from /),
    });
    expect(() => Behavon.getInterface(snapshotOwner)).toThrow(/disposed/);
  });

  it("rejects Hooks in lazy initializers, state/mutable updaters, and Model-input updaters", async () => {
    function Lazy(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime boundary probe needs the lazy initializer invocation, not the state handle
      Behavon.useState(() => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the memo value
        Behavon.useMemo(() => 0, []);
        return 0;
      });
      return undefined;
    }
    expect(() => Behavon.createModel(Lazy, undefined)).toThrow(
      /Behavon\.useMemo cannot be called inside useState lazy initializer/,
    );

    function StateUpdater(): undefined {
      const [value, setValue] = Behavon.useState(0);
      if (value === 0) {
        setValue((previous) => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the memo value
          Behavon.useMemo(() => 0, []);
          return previous + 1;
        });
      }
      return undefined;
    }
    expect(() => Behavon.createModel(StateUpdater, undefined)).toThrow(
      /Behavon\.useMemo cannot be called inside useState functional updater/,
    );

    function MutableUpdater(): undefined {
      const mutable = Behavon.useMutable(0);
      mutable.set((previous) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the memo value
        Behavon.useMemo(() => 0, []);
        return previous + 1;
      });
      return undefined;
    }
    expect(() => Behavon.createModel(MutableUpdater, undefined)).toThrow(
      /Behavon\.useMemo cannot be called inside useMutable functional updater/,
    );

    const target = Behavon.createModel((input: number) => input, 0);
    let setTargetInput: StateSetter<number> | undefined;
    function InputObserver(): undefined {
      const [, setInput] = Behavon.useModel(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setTargetInput = setInput;
      return undefined;
    }
    const observer = Behavon.createModel(InputObserver, undefined);
    observer.dispose();
    const updaterFailure = captureScheduledFailure(() => setTargetInput?.((previous) => {
      // eslint-disable-next-line behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the memo value
      Behavon.useMemo(() => 0, []);
      return previous + 1;
    }));
    expect(String(await updaterFailure)).toMatch(/Behavon\.useMemo cannot be called inside useModel input functional updater/);
    expect(() => Behavon.getInterface(target)).toThrow(/disposed/);
  });

  it("rejects Hooks in evaluation getters, managed callback bodies, and snapshot updaters", () => {
    function Getter(): undefined {
      Behavon.useSyncExternalStore(
        () => () => undefined,
        () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the state handle
          Behavon.useState(0);
          return 0;
        },
      );
      return undefined;
    }
    expect(() => Behavon.createModel(Getter, undefined)).toThrow(
      /Behavon\.useState cannot be called inside useSyncExternalStore evaluation getSnapshot/,
    );

    function Callback(): undefined {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- runtime probe invokes a Hook from a managed callback body
      const callback = Behavon.useCallback(() => Behavon.useState(0), []);
      callback();
      return undefined;
    }
    expect(() => Behavon.createModel(Callback, undefined)).toThrow(
      /Behavon\.useState cannot be called inside managed callback body/,
    );

    const channel = uniqueChannel<number>("nested-snapshot-updater");
    function Snapshot(): undefined {
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      publish((previous) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the state handle
        Behavon.useState(0);
        return previous;
      });
      return undefined;
    }
    expect(() => Behavon.createModel(Snapshot, undefined)).toThrow(
      /Behavon\.useState cannot be called inside useSnapshot functional updater/,
    );
  });

  it("rejects a subscriber Hook without changing synchronous snapshot notification", async () => {
    interface Endpoints {
      readonly publish: Signal;
    }
    const channel = uniqueChannel("nested-snapshot-listener");
    function Model(): undefined {
      const [phase, setPhase] = Behavon.useState(0);
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      if (phase === 1) publish(1);
      const advance = Behavon.useCallback(() => setPhase(1), [setPhase]);
      Behavon.useSignal("publish", advance);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    const unsubscribe = Behavon.subscribe(channel)(() => Behavon.useState(0));
    const failure = await captureScheduledFailure(() => signalOf(root, "publish")());
    expectNestedHookFailure(failure, "useState", "useSnapshot subscriber notification");
    unsubscribe();
    expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
  });

  it("guards reentrant Effect setup and cleanup from borrowing an outer Model context", () => {
    function SetupRoot(): undefined {
      Behavon.useEffect(() => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the state handle
        Behavon.useState(0);
      }, []);
      return undefined;
    }
    function OuterSetup(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime ownerless-creation probe needs the memo factory invocation, not its value
      Behavon.useMemo(() => Behavon.createModel(SetupRoot, undefined), []);
      return undefined;
    }
    expect(() => Behavon.createModel(OuterSetup, undefined)).toThrow(
      /Behavon\.createModel cannot create an ownerless Model while evaluating/,
    );

    function CleanupRoot(): undefined {
      Behavon.useEffect(() => () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested cleanup probe intentionally discards the state handle
        Behavon.useState(0);
      }, []);
      return undefined;
    }
    const cleanupRoot = Behavon.createModel(CleanupRoot, undefined);
    function OuterCleanup(): undefined {
      cleanupRoot.dispose();
      return undefined;
    }
    expect(() => Behavon.createModel(OuterCleanup, undefined)).toThrow(
      /Behavon\.useState cannot be called inside useEffect cleanup/,
    );
  });

  it("guards reentrant external-store subscribe, post-read, listener-read, and unsubscribe", async () => {
    function SubscribeRoot(): undefined {
      Behavon.useSyncExternalStore(
        () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested subscribe probe intentionally discards the state handle
          Behavon.useState(0);
          return () => undefined;
        },
        () => 0,
      );
      return undefined;
    }
    function OuterSubscribe(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime ownerless-creation probe needs the memo factory invocation, not its value
      Behavon.useMemo(() => Behavon.createModel(SubscribeRoot, undefined), []);
      return undefined;
    }
    expect(() => Behavon.createModel(OuterSubscribe, undefined)).toThrow(
      /Behavon\.createModel cannot create an ownerless Model while evaluating/,
    );

    let reads = 0;
    function PostReadRoot(): undefined {
      Behavon.useSyncExternalStore(
        () => () => undefined,
        () => {
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
          reads += 1;
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested post-subscribe read probe intentionally discards the state handle
          if (reads > 1) Behavon.useState(0);
          return 0;
        },
      );
      return undefined;
    }
    function OuterPostRead(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime ownerless-creation probe needs the memo factory invocation, not its value
      Behavon.useMemo(() => Behavon.createModel(PostReadRoot, undefined), []);
      return undefined;
    }
    expect(() => Behavon.createModel(OuterPostRead, undefined)).toThrow(
      /Behavon\.createModel cannot create an ownerless Model while evaluating/,
    );

    let listener: (() => void) | undefined;
    let nestOnRead = false;
    function ListenerRoot(): undefined {
      Behavon.useSyncExternalStore(
        (next) => {
          listener = next;
          return () => undefined;
        },
        () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested snapshot-read probe intentionally discards the state handle
          if (nestOnRead) Behavon.useState(0);
          return 0;
        },
      );
      return undefined;
    }
    const listenerRoot = Behavon.createModel(ListenerRoot, undefined);
    function OuterListener(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      nestOnRead = true;
      listener?.();
      return undefined;
    }
    const listenerFailure = await captureScheduledFailure(() => {
      Behavon.createModel(OuterListener, undefined);
    });
    expect(listenerFailure).toBeInstanceOf(Error);
    expect((listenerFailure as Error).message).toMatch(
      /Behavon\.useState cannot be called inside useSyncExternalStore evaluation getSnapshot/,
    );
    expect(() => listenerRoot.dispose()).toThrow(/dispose\(\) called more than once/);

    function UnsubscribeRoot(): undefined {
      Behavon.useSyncExternalStore(
        () => () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested unsubscribe probe intentionally discards the state handle
          Behavon.useState(0);
        },
        () => 0,
      );
      return undefined;
    }
    const unsubscribeRoot = Behavon.createModel(UnsubscribeRoot, undefined);
    function OuterUnsubscribe(): undefined {
      unsubscribeRoot.dispose();
      return undefined;
    }
    expect(() => Behavon.createModel(OuterUnsubscribe, undefined)).toThrow(
      /Behavon\.useState cannot be called inside useSyncExternalStore unsubscribe/,
    );
  });

  it("restores the restriction frame and preserves original user failures", () => {
    const original = { reason: "factory failed" };
    function OriginalFailure(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- failure-identity probe throws before a memo value can be consumed
      Behavon.useMemo(() => {
        throw original;
      }, []);
      return undefined;
    }
    expect(() => Behavon.createModel(OriginalFailure, undefined)).toThrow(original);

    function useCustomState(): number {
      const [value] = Behavon.useState(7);
      return value;
    }
    function Restored(): undefined {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- runtime probe verifies a managed callback restores the outer Hook context
      const invalid = Behavon.useCallback(() => Behavon.useState(0), []);
      try {
        invalid();
      } catch {
        // The following direct custom Hook must not inherit the callback frame.
      }
      expect(useCustomState()).toBe(7);
      return undefined;
    }
    const root = Behavon.createModel(Restored, undefined);
    root.dispose();
  });

  it("allows direct custom Hooks and rejects ownerless nested Model creation", () => {
    function useCustomState(): number {
      const [value] = Behavon.useState(3);
      return value;
    }
    function Nested(): undefined {
      expect(useCustomState()).toBe(3);
      return undefined;
    }
    function Outer(): undefined {
      expect(useCustomState()).toBe(3);
      // eslint-disable-next-line behavon-hooks/canonical-api -- ownerless-creation probe needs the memo factory invocation, not its value
      Behavon.useMemo(() => {
        Behavon.createModel(Nested, undefined);
      }, []);
      return undefined;
    }

    expect(() => Behavon.createModel(Outer, undefined)).toThrow(
      /Behavon\.createModel cannot create an ownerless Model while evaluating/,
    );
  });

  it("terminates active evaluation after a nested-Hook failure", async () => {
    interface Endpoints {
      readonly fail: Signal;
      readonly recover: Signal;
    }
    const values: number[] = [];
    let fail = false;
    function Model(): undefined {
      const [value, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      values.push(value);
      if (fail) {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- runtime nested-Hook probe intentionally discards the memo value and keeps a paired dependency shape
        Behavon.useMemo(() => Behavon.useState(1), [value]);
      } else {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- paired runtime probe intentionally discards the memo value
        Behavon.useMemo(() => value, [value]);
      }
      const trigger = Behavon.useCallback(() => {
        fail = true;
        setValue(1);
      }, [setValue]);
      Behavon.useSignal("fail", trigger);
      const recover = Behavon.useCallback(() => {
        fail = false;
        setValue(2);
      }, [setValue]);
      Behavon.useSignal("recover", recover);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    expectNestedHookFailure(await captureScheduledFailure(() => signalOf(root, "fail")()), "useState", "useMemo factory");
    expect(values).toEqual([0, 1]);
    expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
  });
});
