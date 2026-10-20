import { describe, expect, it } from "vitest";
import Behave from "behavon";
import type { BoundaryState, ModelInstance, Signal, StateSetter } from "behavon";
import {
  inspectModelInstanceForTests,
  inspectRetainedOperationForTests,
  observeModelInstanceCreationForTests,
} from "../../src/internal/model-inspection";
import { inspectSnapshotChannelForTests } from "../../src/internal/snapshot-channels";
import { uniqueChannel, waitFor } from "../helpers";

async function captureScheduledFailure(trigger: () => void): Promise<unknown> {
  const originalSetTimeout = globalThis.setTimeout;
  let surfaced: unknown;
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

function expectReleased(ref: object, originalModel?: Function): void {
  const terminal = inspectModelInstanceForTests(ref);
  expect(terminal.status).toBe("disposed");
  if (originalModel !== undefined) expect(terminal.model).not.toBe(originalModel);
  expect(terminal.input).toBeUndefined();
  expect(terminal.output).toBeUndefined();
  expect(terminal.hooks).toEqual([]);
  expect(terminal.endpoints.size).toBe(0);
  expect(terminal.endpointCache.size).toBe(0);
  expect(terminal.ownerCell).toBeUndefined();
  expect(terminal.scheduled).toBe(false);
  expect(terminal.independentActivationRequired).toBe(false);
  expect(terminal.evaluating).toBe(false);
  expect(terminal.retainedOperationTargets.size).toBe(0);
}

function expectRetainedOperationReleased(operation: Function, kind: string): void {
  const target = inspectRetainedOperationForTests(operation);
  expect(target.kind).toBe(kind);
  expect(target.cell).toBeUndefined();
  expect((target.owner as { status: string }).status).toBe("disposed");
}

function observeBoundary<Input, Output>(instance: ModelInstance<Input, BoundaryState<Output>>) {
  let state: BoundaryState<Output> | undefined;
  let setInput: StateSetter<Input> | undefined;
  function Observer(): undefined {
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
    [state, setInput] = Behave.useModel(instance);
    return undefined;
  }
  const observer = Behave.createModel(Observer, undefined);
  return {
    get state() {
      return state as BoundaryState<Output>;
    },
    get setInput() {
      return setInput as StateSetter<Input>;
    },
    dispose() {
      observer.dispose();
    },
  };
}

describe("disposed ModelInstance terminal graph release", () => {
  it("scrubs root user state while preserving stale-ref diagnostics and ordinary callback lifetime", () => {
    interface Endpoints {
      readonly ping: Signal;
    }
    const channel = uniqueChannel("model-instance-root-release");
    const input = { source: "input" };
    const output = { source: "output" };
    const state = { source: "state" };
    const dependency = { source: "dependency" };
    const queued = { source: "queued" };
    let setter: StateSetter<typeof state> | undefined;
    let retainedCallback: (() => object) | undefined;

    function Peer(): undefined {
      const alive = Behave.useCallback(() => undefined, []);
      Behave.useSignal("alive", alive);
      return undefined;
    }
    const peer = Behave.createModel(Peer, undefined);

    function Model(modelInput: object): object {
      const [, setValue] = Behave.useState(state);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setter = setValue;
      // eslint-disable-next-line behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- test-only terminal scrub probe intentionally retains an outer dependency in an otherwise unused memo cell
      Behave.useMemo(() => dependency, [dependency]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      retainedCallback = Behave.useCallback(() => modelInput, [modelInput]);
      // eslint-disable-next-line behavon-hooks/canonical-api -- This release probe intentionally retains an otherwise unused dependency Hook cell.
      Behave.usePort(peer);
      Behave.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only terminal scrub probe intentionally retains an outer dependency in an Effect cell
      Behave.useEffect(() => () => void dependency, [dependency]);
      Behave.useSignal("ping", retainedCallback);
      return output;
    }

    const root = Behave.createModel(Model, input);
    const disposeOnly = root.dispose;
    const before = inspectModelInstanceForTests(root as object);
    expect(before.model).toBe(Model);
    expect(before.input).toBe(input);
    expect(before.output).toBe(output);
    expect(before.hooks.length).toBeGreaterThan(0);
    expect(before.endpoints.size).toBe(1);
    expect(before.endpointCache.size).toBeGreaterThan(0);

    setter?.(queued);
    const stateHook = inspectModelInstanceForTests(root as object).hooks.find(
      (hook) => (hook as { kind?: string }).kind === "state",
    ) as { queue: unknown[] };
    expect(stateHook.queue).toEqual([queued]);

    disposeOnly();
    expectReleased(root as object, Model);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
    expect(retainedCallback?.()).toBe(input);
    expect(() => Behave.getInterface(root)).toThrow(/disposed during interface inspection/);
    expect(() => root.ping()).toThrow(/disposed during endpoint lookup 'ping'/);
    expect(() => disposeOnly()).toThrow(/dispose\(\) called more than once/);
    expect(() => Behave.getInterface(peer)).not.toThrow();
    peer.dispose();
  });

  it("finalizes failed construction candidates", () => {
    const created: object[] = [];
    const stopObserving = observeModelInstanceCreationForTests((ref) => created.push(ref));
    const failure = new Error("construction failed");

    function Broken(): never {
      // eslint-disable-next-line behavon-hooks/canonical-api -- failed-construction probe intentionally retains payload in a state cell
      Behave.useState({ retained: true });
      throw failure;
    }
    try {
      expect(() => Behave.createModel(Broken, undefined)).toThrow(failure);
    } finally {
      stopObserving();
    }
    expect(created).toHaveLength(1);
    expectReleased(created[0], Broken);

  });

  it("finalizes a Boundary-contained failed Child without releasing its surviving Parent", async () => {
    const failure = new Error("Child evaluation failed");
    const created: object[] = [];
    const stopObserving = observeModelInstanceCreationForTests((ref) => created.push(ref));

    function Child(input: number): number {
      // eslint-disable-next-line behavon-hooks/canonical-api -- contained-failure probe intentionally retains input in a state cell
      Behave.useState({ payload: input });
      if (input === 2) throw failure;
      return input;
    }
    let instance: ModelInstance<number, BoundaryState<number>>;
    try {
      instance = Behave.createModel(Behave.boundary(Child), 1);
    } finally {
      stopObserving();
    }
    const observed = observeBoundary(instance);
    const firstChild = created.find((ref) => inspectModelInstanceForTests(ref).model === Child);
    expect(firstChild).toBeDefined();
    observed.setInput(2);
    await waitFor(() => observed.state.status === "failed");
    expect(observed.state.status === "failed" ? observed.state.error : undefined).toBe(failure);
    expectReleased(firstChild as object, Child);
    expect(() => Behave.getInterface(instance)).not.toThrow();
    observed.dispose();
    instance.dispose();
  });

  it("finalizes a root after explicit cleanup failure and scheduled commit-phase failure", async () => {
    const disposeFailure = new Error("explicit cleanup failed");
    function ExplicitFailure(): undefined {
      Behave.useEffect(() => () => {
        throw disposeFailure;
      }, []);
      return undefined;
    }
    const explicitRoot = Behave.createModel(ExplicitFailure, undefined);
    expect(() => explicitRoot.dispose()).toThrow(disposeFailure);
    expectReleased(explicitRoot as object, ExplicitFailure);

    const unsubscribeFailure = new Error("explicit unsubscribe failed");
    function ExplicitUnsubscribeFailure(): undefined {
      Behave.useSyncExternalStore(
        () => () => {
          throw unsubscribeFailure;
        },
        () => 0,
      );
      return undefined;
    }
    const unsubscribeRoot = Behave.createModel(ExplicitUnsubscribeFailure, undefined);
    expect(() => unsubscribeRoot.dispose()).toThrow(unsubscribeFailure);
    expectReleased(unsubscribeRoot as object, ExplicitUnsubscribeFailure);

    const setupFailure = new Error("scheduled setup failed");
    let fail: (() => void) | undefined;
    function ScheduledFailure(): undefined {
      const [phase, setPhase] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fail = Behave.useCallback(() => setPhase(1), [setPhase]);
      Behave.useEffect(() => {
        if (phase === 1) throw setupFailure;
      }, [phase]);
      return undefined;
    }
    const scheduledRoot = Behave.createModel(ScheduledFailure, undefined);
    expect(await captureScheduledFailure(() => fail?.())).toBe(setupFailure);
    expectReleased(scheduledRoot as object, ScheduledFailure);
  });
});

describe("retained Model operation terminal graph release", () => {
  it("separates consumer cleanup from instance-owned setter terminal release", async () => {
    let stateSetter: StateSetter<number> | undefined;
    let modelSetter: StateSetter<number> | undefined;
    let renderCount = 0;

    function Child(input: number): number {
      return input;
    }
    const child = Behave.createModel(Child, 0);
    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      renderCount += 1;
      const [, setState] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, modelSetter] = Behave.useModel(child);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      stateSetter = setState;
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    const firstStateSetter = stateSetter as StateSetter<number>;
    expect(inspectRetainedOperationForTests(firstStateSetter).cell).toBeDefined();
    firstStateSetter(1);
    await waitFor(() => renderCount === 2);
    expect(stateSetter).toBe(firstStateSetter);

    root.dispose();
    expectRetainedOperationReleased(firstStateSetter, "stateSetter");
    expect(() => firstStateSetter(2)).not.toThrow();
    expect(() => modelSetter?.(2)).not.toThrow();

    function CrossOwner(): undefined {
      firstStateSetter(3);
      return undefined;
    }
    expect(() => Behave.createModel(CrossOwner, undefined)).toThrow(
      /useState setter for target Model#\d+ cannot be called while evaluating source Model#\d+/,
    );
    child.dispose();
    const modelTarget = inspectRetainedOperationForTests(modelSetter as Function);
    expect(modelTarget.kind).toBe("modelInputSetter");
    expect(modelTarget.instance).toBeUndefined();
    expect(() => modelSetter?.(3)).toThrow(/requires a live Model instance/);
  });

  it("detaches failed Boundary reset together with its shared Boundary operation target", () => {
    const failure = new Error("Boundary Child failed");
    let failedChildSetter: StateSetter<{ retainedByFailedChild: boolean }> | undefined;

    function Broken(_input: number): never {
      const [, setValue] = Behave.useState({ retainedByFailedChild: true });
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      failedChildSetter = setValue;
      throw failure;
    }
    const instance = Behave.createModel(Behave.boundary(Broken), 1);
    const observed = observeBoundary(instance);
    expect(observed.state.status).toBe("failed");
    const reset = (observed.state as Extract<BoundaryState<never>, { status: "failed" }>).reset;
    const resetTarget = inspectRetainedOperationForTests(reset);
    expect(resetTarget.cell).toBeDefined();
    expectRetainedOperationReleased(failedChildSetter as Function, "stateSetter");

    observed.dispose();
    instance.dispose();
    expectRetainedOperationReleased(reset, "modelBoundaryOperation");
    expect(() => reset()).not.toThrow();
  });

  it("detaches an externally retained listener after normal disposal and cleanup failure", () => {
    let listener: (() => void) | undefined;
    let snapshotReads = 0;
    const cleanupFailure = new Error("unsubscribe failed");

    function Model(): undefined {
      Behave.useSyncExternalStore(
        (nextListener) => {
          listener = nextListener;
          return () => {
            throw cleanupFailure;
          };
        },
        () => {
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
          snapshotReads += 1;
          return 0;
        },
      );
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    const retained = listener as () => void;
    expect(inspectRetainedOperationForTests(retained).cell).toBeDefined();
    expect(() => root.dispose()).toThrow(cleanupFailure);
    expectRetainedOperationReleased(retained, "externalStoreListener");
    const readsAfterDispose = snapshotReads;
    retained();
    expect(snapshotReads).toBe(readsAfterDispose);
  });

  it("detaches operations escaped from failed construction and subscribe failure", () => {
    const constructionFailure = new Error("construction failed after setter escaped");
    let escapedSetter: StateSetter<{ payload: boolean }> | undefined;
    function BrokenConstruction(): never {
      const [, setValue] = Behave.useState({ payload: true });
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      escapedSetter = setValue;
      throw constructionFailure;
    }
    expect(() => Behave.createModel(BrokenConstruction, undefined)).toThrow(constructionFailure);
    expectRetainedOperationReleased(escapedSetter as Function, "stateSetter");

    const subscribeFailure = new Error("subscribe failed after listener escaped");
    let escapedListener: (() => void) | undefined;
    function BrokenSubscription(): undefined {
      Behave.useSyncExternalStore(
        (listener) => {
          escapedListener = listener;
          throw subscribeFailure;
        },
        () => ({ payload: true }),
      );
      return undefined;
    }
    expect(() => Behave.createModel(BrokenSubscription, undefined)).toThrow(subscribeFailure);
    expectRetainedOperationReleased(escapedListener as Function, "externalStoreListener");
    expect(() => escapedListener?.()).not.toThrow();
  });

  it("detaches the committed setter of a Boundary-contained Child that fails reevaluation", async () => {
    const failure = new Error("Child reevaluation failed");
    let childSetter: StateSetter<{ input: number }> | undefined;

    function Child(input: number): number {
      const [, setValue] = Behave.useState({ input });
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      childSetter = setValue;
      if (input === 2) throw failure;
      return input;
    }
    const instance = Behave.createModel(Behave.boundary(Child), 1);
    const observed = observeBoundary(instance);
    const retained = childSetter as StateSetter<{ input: number }>;
    observed.setInput(2);
    await waitFor(() => observed.state.status === "failed");
    expectRetainedOperationReleased(retained, "stateSetter");
    expect(() => retained({ input: 3 })).not.toThrow();
    observed.dispose();
    instance.dispose();
  });
});
