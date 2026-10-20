import { afterAll, describe, expect, it } from "vitest";
import Behave from "behavon";
import type { Signal, StateSetter, UntypedModelRef } from "behavon";
import { uniqueChannel, waitFor } from "../helpers";

const nestedModelProbe = Behave.createModel((input: number) => input, 0);
const nestedSnapshotProbe = Behave.createId(Behave.SnapshotType<unknown>());
const nestedStateProbe = Behave.createId({ value: Behave.StateType<unknown>() });
const nestedResourceProbe = Behave.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});
const changedStateProbe = Behave.createId({
  first: Behave.StateType<number>(),
  second: Behave.StateType<number>(),
});
const changedResourceProbeA = Behave.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});
const changedResourceProbeB = Behave.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});
const changedSnapshotProbeA = Behave.createId(Behave.SnapshotType<number>());
const changedSnapshotProbeB = Behave.createId(Behave.SnapshotType<number>());
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
    new RegExp(`^Behave\\.${hook} cannot be called inside ${boundary} while evaluating Model#\\d+$`),
  );
}

describe("runtime-known Hook authoring boundaries", () => {
  const publicHooks: ReadonlyArray<readonly [string, () => unknown]> = [
    ["useState", () => Behave.useState(0)],
    ["useReducer", () => Behave.useReducer((state: number) => state, 0)],
    ["useLabelState", () => Behave.useLabelState(nestedStateProbe.value, 0)],
    ["useMutable", () => Behave.useMutable(0)],
    ["useMemo", () => Behave.useMemo(() => 0, [])],
    ["useCallback", () => Behave.useCallback(() => undefined, [])],
    ["useEffect", () => Behave.useEffect(() => undefined, [])],
    ["useFuture", () => Behave.useFuture(async () => undefined, { concurrency: "serial" })],
    ["useResource", () => Behave.useResource(nestedResourceProbe, undefined)],
    ["useSyncExternalStore", () => Behave.useSyncExternalStore(() => () => undefined, () => 0)],
    ["useSignal", () => Behave.useSignal("nested", () => undefined)],
    ["useSlot", () => Behave.useSlot("nested", () => undefined)],
    ["useExport", () => Behave.useExport(() => ({ nested: true }))],
    ["useModel", () => Behave.useModel(nestedModelProbe)],
    ["usePort", () => Behave.usePort(undefined as never)],
    ["useConnect", () => Behave.useConnect(undefined as never, undefined as never)],
    ["useSnapshot", () => Behave.useSnapshot(nestedSnapshotProbe)],
  ];

  for (const [hook, invoke] of publicHooks) {
    it(`rejects ${hook} before argument processing outside Model evaluation`, () => {
      expect(invoke).toThrow(`Behave.${hook} must be called while evaluating a Model`);
    });
  }

  for (const [hook, invoke] of publicHooks) {
    it(`rejects ${hook} before argument or resource processing inside a memo factory`, () => {
      function Model(): undefined {
        // eslint-disable-next-line behavon-hooks/canonical-api -- runtime boundary probe needs the memo factory invocation, not its value
        Behave.useMemo(() => invoke(), []);
        return undefined;
      }

      let failure: unknown;
      try {
        Behave.createModel(Model, undefined);
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
      const [, setTick] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const labeled = Behave.useLabelState(
        useSecond ? changedStateProbe.second : changedStateProbe.first,
        0,
      );
      return labeled[0];
    }
    const labeledStateOwner = Behave.createModel(LabeledStateModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: "Behave.useLabelState StateId changed at the same Hook position",
    });
    expect(() => Behave.getInterface(labeledStateOwner)).toThrow(/disposed/);

    useSecond = false;
    rerender = undefined;
    function ResourceModel(): string {
      const [, setTick] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const resource = Behave.useResource(
        useSecond ? changedResourceProbeB : changedResourceProbeA,
        undefined,
      );
      return resource[0].phase;
    }
    const resourceOwner = Behave.createModel(ResourceModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: "Behave.useResource ResourceType changed at the same Hook position",
    });
    expect(() => Behave.getInterface(resourceOwner)).toThrow(/disposed/);

    useSecond = false;
    rerender = undefined;
    function SignalModel(): undefined {
      const [, setTick] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const callback = Behave.useCallback(() => undefined, []);
      Behave.useSignal(useSecond ? "second" : "first", callback);
      return undefined;
    }
    const signalOwner = Behave.createModel(SignalModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: "Behave public endpoint declaration changed from 'first' to 'second'",
    });
    expect(() => Behave.getInterface(signalOwner)).toThrow(/disposed/);

    useSecond = false;
    rerender = undefined;
    function SlotModel(): undefined {
      const [, setTick] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const callback = Behave.useCallback(() => undefined, []);
      Behave.useSlot(useSecond ? "second" : "first", callback);
      return undefined;
    }
    const slotOwner = Behave.createModel(SlotModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: "Behave public endpoint declaration changed from 'first' to 'second'",
    });
    expect(() => Behave.getInterface(slotOwner)).toThrow(/disposed/);

    useSecond = false;
    rerender = undefined;
    function SnapshotModel(): undefined {
      const [, setTick] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the rerender trigger
      rerender = setTick;
      const snapshot = Behave.useSnapshot(useSecond ? changedSnapshotProbeB : changedSnapshotProbeA);
      void snapshot;
      return undefined;
    }
    const snapshotOwner = Behave.createModel(SnapshotModel, undefined);
    useSecond = true;
    expect(await captureScheduledFailure(() => rerender?.(1))).toMatchObject({
      message: expect.stringMatching(/^Behave snapshot declaration changed from /),
    });
    expect(() => Behave.getInterface(snapshotOwner)).toThrow(/disposed/);
  });

  it("rejects Hooks in lazy initializers, state/mutable updaters, and Model-input updaters", async () => {
    function Lazy(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime boundary probe needs the lazy initializer invocation, not the state handle
      Behave.useState(() => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the memo value
        Behave.useMemo(() => 0, []);
        return 0;
      });
      return undefined;
    }
    expect(() => Behave.createModel(Lazy, undefined)).toThrow(
      /Behave\.useMemo cannot be called inside useState lazy initializer/,
    );

    function StateUpdater(): undefined {
      const [value, setValue] = Behave.useState(0);
      if (value === 0) {
        setValue((previous) => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the memo value
          Behave.useMemo(() => 0, []);
          return previous + 1;
        });
      }
      return undefined;
    }
    expect(() => Behave.createModel(StateUpdater, undefined)).toThrow(
      /Behave\.useMemo cannot be called inside useState functional updater/,
    );

    function MutableUpdater(): undefined {
      const mutable = Behave.useMutable(0);
      mutable.set((previous) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the memo value
        Behave.useMemo(() => 0, []);
        return previous + 1;
      });
      return undefined;
    }
    expect(() => Behave.createModel(MutableUpdater, undefined)).toThrow(
      /Behave\.useMemo cannot be called inside useMutable functional updater/,
    );

    const target = Behave.createModel((input: number) => input, 0);
    let setTargetInput: StateSetter<number> | undefined;
    function InputObserver(): undefined {
      const [, setInput] = Behave.useModel(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setTargetInput = setInput;
      return undefined;
    }
    const observer = Behave.createModel(InputObserver, undefined);
    observer.dispose();
    const updaterFailure = captureScheduledFailure(() => setTargetInput?.((previous) => {
      // eslint-disable-next-line behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the memo value
      Behave.useMemo(() => 0, []);
      return previous + 1;
    }));
    expect(String(await updaterFailure)).toMatch(/Behave\.useMemo cannot be called inside useModel input functional updater/);
    expect(() => Behave.getInterface(target)).toThrow(/disposed/);
  });

  it("rejects Hooks in evaluation getters, managed callback bodies, and snapshot updaters", () => {
    function Getter(): undefined {
      Behave.useSyncExternalStore(
        () => () => undefined,
        () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the state handle
          Behave.useState(0);
          return 0;
        },
      );
      return undefined;
    }
    expect(() => Behave.createModel(Getter, undefined)).toThrow(
      /Behave\.useState cannot be called inside useSyncExternalStore evaluation getSnapshot/,
    );

    function Callback(): undefined {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- runtime probe invokes a Hook from a managed callback body
      const callback = Behave.useCallback(() => Behave.useState(0), []);
      callback();
      return undefined;
    }
    expect(() => Behave.createModel(Callback, undefined)).toThrow(
      /Behave\.useState cannot be called inside managed callback body/,
    );

    const channel = uniqueChannel<number>("nested-snapshot-updater");
    function Snapshot(): undefined {
      const [, publish] = Behave.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      publish((previous) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the state handle
        Behave.useState(0);
        return previous;
      });
      return undefined;
    }
    expect(() => Behave.createModel(Snapshot, undefined)).toThrow(
      /Behave\.useState cannot be called inside useSnapshot functional updater/,
    );
  });

  it("rejects a subscriber Hook without changing synchronous snapshot notification", async () => {
    interface Endpoints {
      readonly publish: Signal;
    }
    const channel = uniqueChannel("nested-snapshot-listener");
    function Model(): undefined {
      const [phase, setPhase] = Behave.useState(0);
      const [, publish] = Behave.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      if (phase === 1) publish(1);
      const advance = Behave.useCallback(() => setPhase(1), [setPhase]);
      Behave.useSignal("publish", advance);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    const unsubscribe = Behave.subscribe(channel)(() => Behave.useState(0));
    const failure = await captureScheduledFailure(() => root.publish());
    expectNestedHookFailure(failure, "useState", "useSnapshot subscriber notification");
    unsubscribe();
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("guards reentrant Effect setup and cleanup from borrowing an outer Model context", () => {
    function SetupRoot(): undefined {
      Behave.useEffect(() => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested runtime authoring probe intentionally discards the state handle
        Behave.useState(0);
      }, []);
      return undefined;
    }
    function OuterSetup(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime ownerless-creation probe needs the memo factory invocation, not its value
      Behave.useMemo(() => Behave.createModel(SetupRoot, undefined), []);
      return undefined;
    }
    expect(() => Behave.createModel(OuterSetup, undefined)).toThrow(
      /Behave\.createModel cannot create an ownerless Model while evaluating/,
    );

    function CleanupRoot(): undefined {
      Behave.useEffect(() => () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested cleanup probe intentionally discards the state handle
        Behave.useState(0);
      }, []);
      return undefined;
    }
    const cleanupRoot = Behave.createModel(CleanupRoot, undefined);
    function OuterCleanup(): undefined {
      cleanupRoot.dispose();
      return undefined;
    }
    expect(() => Behave.createModel(OuterCleanup, undefined)).toThrow(
      /Behave\.useState cannot be called inside useEffect cleanup/,
    );
  });

  it("guards reentrant external-store subscribe, post-read, listener-read, and unsubscribe", async () => {
    function SubscribeRoot(): undefined {
      Behave.useSyncExternalStore(
        () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested subscribe probe intentionally discards the state handle
          Behave.useState(0);
          return () => undefined;
        },
        () => 0,
      );
      return undefined;
    }
    function OuterSubscribe(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime ownerless-creation probe needs the memo factory invocation, not its value
      Behave.useMemo(() => Behave.createModel(SubscribeRoot, undefined), []);
      return undefined;
    }
    expect(() => Behave.createModel(OuterSubscribe, undefined)).toThrow(
      /Behave\.createModel cannot create an ownerless Model while evaluating/,
    );

    let reads = 0;
    function PostReadRoot(): undefined {
      Behave.useSyncExternalStore(
        () => () => undefined,
        () => {
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
          reads += 1;
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested post-subscribe read probe intentionally discards the state handle
          if (reads > 1) Behave.useState(0);
          return 0;
        },
      );
      return undefined;
    }
    function OuterPostRead(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime ownerless-creation probe needs the memo factory invocation, not its value
      Behave.useMemo(() => Behave.createModel(PostReadRoot, undefined), []);
      return undefined;
    }
    expect(() => Behave.createModel(OuterPostRead, undefined)).toThrow(
      /Behave\.createModel cannot create an ownerless Model while evaluating/,
    );

    let listener: (() => void) | undefined;
    let nestOnRead = false;
    function ListenerRoot(): undefined {
      Behave.useSyncExternalStore(
        (next) => {
          listener = next;
          return () => undefined;
        },
        () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested snapshot-read probe intentionally discards the state handle
          if (nestOnRead) Behave.useState(0);
          return 0;
        },
      );
      return undefined;
    }
    const listenerRoot = Behave.createModel(ListenerRoot, undefined);
    function OuterListener(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      nestOnRead = true;
      listener?.();
      return undefined;
    }
    const listenerFailure = await captureScheduledFailure(() => {
      Behave.createModel(OuterListener, undefined);
    });
    expect(listenerFailure).toBeInstanceOf(Error);
    expect((listenerFailure as Error).message).toMatch(
      /Behave\.useState cannot be called inside useSyncExternalStore evaluation getSnapshot/,
    );
    expect(() => listenerRoot.dispose()).toThrow(/dispose\(\) called more than once/);

    function UnsubscribeRoot(): undefined {
      Behave.useSyncExternalStore(
        () => () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- nested unsubscribe probe intentionally discards the state handle
          Behave.useState(0);
        },
        () => 0,
      );
      return undefined;
    }
    const unsubscribeRoot = Behave.createModel(UnsubscribeRoot, undefined);
    function OuterUnsubscribe(): undefined {
      unsubscribeRoot.dispose();
      return undefined;
    }
    expect(() => Behave.createModel(OuterUnsubscribe, undefined)).toThrow(
      /Behave\.useState cannot be called inside useSyncExternalStore unsubscribe/,
    );
  });

  it("restores the restriction frame and preserves original user failures", () => {
    const original = { reason: "factory failed" };
    function OriginalFailure(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- failure-identity probe throws before a memo value can be consumed
      Behave.useMemo(() => {
        throw original;
      }, []);
      return undefined;
    }
    expect(() => Behave.createModel(OriginalFailure, undefined)).toThrow(original);

    function useCustomState(): number {
      const [value] = Behave.useState(7);
      return value;
    }
    function Restored(): undefined {
      // eslint-disable-next-line react-hooks/rules-of-hooks -- runtime probe verifies a managed callback restores the outer Hook context
      const invalid = Behave.useCallback(() => Behave.useState(0), []);
      try {
        invalid();
      } catch {
        // The following direct custom Hook must not inherit the callback frame.
      }
      expect(useCustomState()).toBe(7);
      return undefined;
    }
    const root = Behave.createModel(Restored, undefined);
    root.dispose();
  });

  it("allows direct custom Hooks and rejects ownerless nested Model creation", () => {
    function useCustomState(): number {
      const [value] = Behave.useState(3);
      return value;
    }
    function Nested(): undefined {
      expect(useCustomState()).toBe(3);
      return undefined;
    }
    function Outer(): undefined {
      expect(useCustomState()).toBe(3);
      // eslint-disable-next-line behavon-hooks/canonical-api -- ownerless-creation probe needs the memo factory invocation, not its value
      Behave.useMemo(() => {
        Behave.createModel(Nested, undefined);
      }, []);
      return undefined;
    }

    expect(() => Behave.createModel(Outer, undefined)).toThrow(
      /Behave\.createModel cannot create an ownerless Model while evaluating/,
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
      const [value, setValue] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      values.push(value);
      if (fail) {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- runtime nested-Hook probe intentionally discards the memo value and keeps a paired dependency shape
        Behave.useMemo(() => Behave.useState(1), [value]);
      } else {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- paired runtime probe intentionally discards the memo value
        Behave.useMemo(() => value, [value]);
      }
      const trigger = Behave.useCallback(() => {
        fail = true;
        setValue(1);
      }, [setValue]);
      Behave.useSignal("fail", trigger);
      const recover = Behave.useCallback(() => {
        fail = false;
        setValue(2);
      }, [setValue]);
      Behave.useSignal("recover", recover);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expectNestedHookFailure(await captureScheduledFailure(() => root.fail()), "useState", "useMemo factory");
    expect(values).toEqual([0, 1]);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });
});
