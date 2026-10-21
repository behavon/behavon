import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
import { describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import type { Signal, Slot, TypedModelRef } from "behavon";
import { inspectSnapshotChannelForTests } from "../../src/internal/snapshot-channels";
import { uniqueChannel, waitFor, waitForSnapshot, signalOf } from "../helpers";

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

describe("Model construction and React-corresponding hooks", () => {
  it("exports createModel without a createModelRoot compatibility alias", () => {
    expect(typeof Behavon.createModel).toBe("function");
    expect(
      (Behavon as unknown as Readonly<Record<string, unknown>>).createModelRoot,
    ).toBeUndefined();
  });

  it("rejects Model hooks outside an active Model evaluation", () => {
    expect(() => Behavon.useState(0)).toThrow();
    expect(() => Behavon.useMemo(() => 1, [])).toThrow();
    expect(() => Behavon.useCallback(() => undefined, [])).toThrow();
    expect(() => Behavon.useEffect(() => undefined, [])).toThrow();
  });

  it("evaluates a root synchronously with the exact initial input", () => {
    const input = { token: {} };
    let received: typeof input | undefined;

    function Root(next: typeof input): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      received = next;
      return undefined;
    }

    const root = Behavon.createModel(Root, input);
    expect(received).toBe(input);
    root.dispose();
  });

  it("evaluates a nullable root with null as its exact initial input", () => {
    const received: Array<string | null> = [];
    function Root(input: string | null): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      received.push(input);
      return undefined;
    }

    const root = Behavon.createModel(Root, null);
    expect(received).toEqual([null]);
    root.dispose();
  });

  it("does not activate registrations from a failed construction", () => {
    const channel = uniqueChannel("failed-construction");
    const failure = new Error("construction failed");

    type BrokenPortType = { "leaked": PortOnlySignal<any> };
    const brokenPort = Behavon.createPort<BrokenPortType>({ "leaked": Behavon.SignalType() });
    function Broken(): never {
      const callback = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal(brokenPort, "leaked", callback);
      Behavon.useExport(brokenPort, "leaked");
      Behavon.useSnapshot(channel);
      throw failure;
    }

    expect(() => Behavon.createModel((Broken as unknown as Model<any, any, BrokenPortType>), undefined)).toThrow(failure);

    function Replacement(): undefined {
      Behavon.useSnapshot(channel);
      return undefined;
    }

    const replacement = Behavon.createModel(Replacement, undefined);
    expect(Behavon.getSnapshot(channel)()).toBeUndefined();
    replacement.dispose();
  });

  it("composes queued functional updates and preserves memo/callback identity", async () => {
    const channel = uniqueChannel("state-hooks");
    const callbackIdentities: Array<() => void> = [];
    let memoRuns = 0;

    interface Endpoints {
      readonly incrementTwice: Signal;
      readonly publishAgain: Signal;
    }

    interface Snapshot {
      readonly count: number;
      readonly doubled: number;
      readonly callback: () => void;
    }

    type ModelPortType = { "incrementTwice": PortOnlySignal<any>; "publishAgain": PortOnlySignal<any> };
    const modelPort = Behavon.createPort<ModelPortType>({ "incrementTwice": Behavon.SignalType(), "publishAgain": Behavon.SignalType() });
    function Model(): Snapshot {
      const [count, setCount] = Behavon.useState(() => 0);
      const [, publish] = Behavon.useSnapshot(channel);
      const doubled = Behavon.useMemo(() => {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        memoRuns += 1;
        return count * 2;
      }, [count]);
      const stable = Behavon.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbackIdentities.push(stable);
      const incrementTwice = Behavon.useCallback(() => {
        setCount((previous) => previous + 1);
        setCount((previous) => previous + 1);
      }, [setCount]);
      const publishAgain = Behavon.useCallback(() => setCount((previous) => previous), [setCount]);
      Behavon.useSignal(modelPort, "incrementTwice", incrementTwice);
      Behavon.useExport(modelPort, "incrementTwice");
      Behavon.useSignal(modelPort, "publishAgain", publishAgain);
      Behavon.useExport(modelPort, "publishAgain");
      const snapshot = Behavon.useMemo(() => ({ count, doubled, callback: stable }), [count, doubled, stable]);
      Behavon.useEffect(() => {
        publish(snapshot);
      }, [publish, snapshot]);
      return snapshot;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPortType>), undefined);
    await waitForSnapshot<Snapshot>(channel, (value) => value?.count === 0);
    signalOf(root, "incrementTwice")();
    const snapshot = await waitForSnapshot<Snapshot>(channel, (value) => value?.count === 2);
    expect(snapshot).toMatchObject({ count: 2, doubled: 4 });
    expect(callbackIdentities.at(-1)).toBe(callbackIdentities[0]);
    expect(memoRuns).toBe(2);
    signalOf(root, "publishAgain")();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(memoRuns).toBe(2);
    root.dispose();
  });

  it("applies a state update requested during evaluation through the Model scheduler", async () => {
    const channel = uniqueChannel("evaluation-update");
    const evaluations: number[] = [];

    function Model(): number {
      const [value, setValue] = Behavon.useState(0);
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations.push(value);
      if (value === 0) setValue(1);
      Behavon.useEffect(() => {
        publish(value);
      }, [publish, value]);
      return value;
    }

    const root = Behavon.createModel(Model, undefined);
    await waitForSnapshot<number>(channel, (value) => value === 1);
    expect(evaluations).toEqual([0, 1]);
    root.dispose();
  });

  it("runs effects after activation, cleans before replacement, and cleans on dispose", async () => {
    const log: string[] = [];
    let setChildInput: ((input: { readonly value: number }) => void) | undefined;

    function Child(input: { readonly value: number }): undefined {
      Behavon.useEffect(() => {
        log.push(`setup:${input.value}`);
        return () => log.push(`cleanup:${input.value}`);
      }, [input.value]);
      return undefined;
    }

    const child = Behavon.createModel(Child, { value: 1 });
    function Observer(): undefined {
      const [, setInput] = Behavon.useModel(child);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setChildInput = setInput;
      return undefined;
    }

    const root = Behavon.createModel(Observer, undefined);
    await waitFor(() => log.includes("setup:1"));
    setChildInput?.({ value: 2 });
    await waitFor(() => log.includes("setup:2"));
    expect(log).toEqual(["setup:1", "cleanup:1", "setup:2"]);
    root.dispose();
    child.dispose();
    expect(log).toEqual(["setup:1", "cleanup:1", "setup:2", "cleanup:2"]);
  });

  it("subscribes an external store without missing changes and unsubscribes on dispose", async () => {
    const channel = uniqueChannel("external-store");
    let current = 0;
    const listeners = new Set<() => void>();
    let unsubscribeCount = 0;
    const subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => {
        unsubscribeCount += 1;
        listeners.delete(listener);
      };
    };
    const getSnapshot = () => current;

    function ExternalModel(): number {
      const value = Behavon.useSyncExternalStore(subscribe, getSnapshot);
      const [, publish] = Behavon.useSnapshot(channel);
      Behavon.useEffect(() => {
        publish(value);
      }, [publish, value]);
      return value;
    }

    const root = Behavon.createModel(ExternalModel, undefined);
    await waitForSnapshot<number>(channel, (value) => value === 0);
    current = 1;
    for (const listener of [...listeners]) listener();
    await waitForSnapshot<number>(channel, (value) => value === 1);
    root.dispose();
    expect(unsubscribeCount).toBe(1);
    expect(listeners.size).toBe(0);
  });

  it("keeps evaluation-time publish independent and exposes its exact identity on a later evaluation", async () => {
    interface Endpoints {
      readonly reevaluate: Signal;
    }

    const channel = uniqueChannel("evaluation-publish");
    const published = { version: 1 } as const;
    const seen: Array<typeof published | undefined> = [];
    const trace: string[] = [];
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let evaluations = 0;
    function Keeper(): undefined {
      Behavon.useSnapshot(channel);
      return undefined;
    }

    const keeper = Behavon.createModel(Keeper, undefined);
    const unsubscribe = Behavon.subscribe(channel)(() => trace.push("listener"));

    type ModelPort1Type = { "reevaluate": PortOnlySignal<any> };
    const modelPort1 = Behavon.createPort<ModelPort1Type>({ "reevaluate": Behavon.SignalType() });
    function Model(): undefined {
      const [, setEpoch] = Behavon.useState(0);
      const [snapshot, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      seen.push(snapshot);
      if (snapshot === undefined) {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        publish(published);
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        trace.push("after-publish");
      }
      const reevaluate = Behavon.useCallback(() => setEpoch((previous) => previous + 1), [setEpoch]);
      Behavon.useSignal(modelPort1, "reevaluate", reevaluate);
      Behavon.useExport(modelPort1, "reevaluate");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      trace.push("evaluation-complete");
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort1Type>), undefined);
    expect(Behavon.getSnapshot(channel)()).toBe(published);
    expect(seen).toEqual([undefined]);
    expect(evaluations).toBe(1);
    expect(trace).toEqual(["listener", "after-publish", "evaluation-complete"]);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(
      /Model#\d+ called useSnapshot\.publish '.*' owned by Model#\d+ while evaluating.*Behavon\.useEffect.*managed callback/,
    ));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(evaluations).toBe(1);

    signalOf(root, "reevaluate")();
    await waitFor(() => evaluations === 2);
    expect(seen[1]).toBe(published);
    unsubscribe();
    root.dispose();
    keeper.dispose();
    warning.mockRestore();
  });

  it("deduplicates evaluation-time publish warnings across render retries", () => {
    const channel = uniqueChannel("evaluation-publish-retry");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const published = { value: 1 } as const;
    function Model(): undefined {
      const [attempt, setAttempt] = Behavon.useState(0);
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      publish(published);
      if (attempt === 0) setAttempt(1);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    expect(Behavon.getSnapshot(channel)()).toBe(published);
    expect(warning).toHaveBeenCalledTimes(1);
    root.dispose();
    warning.mockRestore();
  });

  it("discards a provisional-only channel and publication when initial construction fails", () => {
    const channel = uniqueChannel("failed-publication");
    const published = { durable: true } as const;
    const failure = new Error("evaluation failed after publish");

    function Broken(): never {
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      publish(published);
      throw failure;
    }

    expect(() => Behavon.createModel(Broken, undefined)).toThrow(failure);
    expect(() => Behavon.getSnapshot(channel)).toThrow(/no live owner/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("keeps a completed publication when a failed new owner used an existing live channel", () => {
    const channel = uniqueChannel("failed-shared-publication");
    const published = { durable: "shared" } as const;
    const failure = new Error("new owner failed after publish");

    function Keeper(): undefined {
      Behavon.useSnapshot(channel);
      return undefined;
    }
    function Broken(): never {
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      publish(published);
      throw failure;
    }

    const keeper = Behavon.createModel(Keeper, undefined);
    expect(() => Behavon.createModel(Broken, undefined)).toThrow(failure);
    expect(Behavon.getSnapshot(channel)()).toBe(published);
    expect(inspectSnapshotChannelForTests(channel)?.ownerCount).toBe(1);
    expect(inspectSnapshotChannelForTests(channel)?.provisionalOwnerCount).toBe(0);
    keeper.dispose();
  });

  it("keeps a queued publication from a failed reevaluation of an active Model", async () => {
    interface Endpoints {
      readonly fail: Signal;
    }

    const channel = uniqueChannel("failed-active-reevaluation-publication");
    const published = { durable: "active" } as const;
    const failure = new Error("active reevaluation failed after publish");
    let surfaced: unknown;
    let observed: typeof published | undefined;

    type ModelPort2Type = { "fail": PortOnlySignal<any> };
    const modelPort2 = Behavon.createPort<ModelPort2Type>({ "fail": Behavon.SignalType() });
    function Model(): undefined {
      const [shouldFail, setShouldFail] = Behavon.useState(false);
      const [, publish] = Behavon.useSnapshot(channel);
      if (shouldFail) {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        publish(published);
        throw failure;
      }
      const fail = Behavon.useCallback(() => setShouldFail(true), [setShouldFail]);
      Behavon.useSignal(modelPort2, "fail", fail);
      Behavon.useExport(modelPort2, "fail");
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort2Type>), undefined);
    const unsubscribe = Behavon.subscribe(channel)(() => {
      observed = Behavon.getSnapshot(channel)();
    });
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
      signalOf(root, "fail")();
      await Promise.resolve();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(surfaced).toBe(failure);
    expect(observed).toBe(published);
    unsubscribe();
    expect(() => Behavon.getSnapshot(channel)).toThrow(/no live owner/);
    expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
  });

  it("does not reactivate a Model that disposes itself during a scheduled reevaluation", async () => {
    interface Endpoints {
      readonly stop: Signal;
    }

    const channel = uniqueChannel("self-dispose-reevaluation");
    let root: TypedModelRef<any> | undefined;
    let capturedPublish: ((value: number | undefined) => void) | undefined;
    let surfaced: unknown;

    type ModelPort3Type = { "stop": PortOnlySignal<any> };
    const modelPort3 = Behavon.createPort<ModelPort3Type>({ "stop": Behavon.SignalType() });
    function Model(): undefined {
      const [shouldDispose, setShouldDispose] = Behavon.useState(false);
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      capturedPublish = publish;
      if (shouldDispose) root?.dispose();
      const stop = Behavon.useCallback(() => setShouldDispose(true), [setShouldDispose]);
      Behavon.useSignal(modelPort3, "stop", stop);
      Behavon.useExport(modelPort3, "stop");
      return undefined;
    }

    root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort3Type>), undefined);
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
      signalOf(root, "stop")();
      await Promise.resolve();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(surfaced).toBeInstanceOf(Error);
    expect(String(surfaced)).toMatch(/disposed during evaluation.*cannot be committed/);
    expect(() => Behavon.getInterface(root as TypedModelRef<any>)).toThrow(/disposed/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
    expect(() => capturedPublish?.(1)).not.toThrow();
    expect(() => Behavon.getSnapshot(channel)).toThrow(/no live owner/);
  });

  it("runs an omitted-dependency effect after every committed evaluation", async () => {
    let advance: (() => void) | undefined;
    const trace: string[] = [];

    function Model(): undefined {
      const [epoch, setEpoch] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      advance = () => setEpoch((previous) => previous + 1);
      Behavon.useEffect(() => {
        trace.push(`setup:${epoch}`);
        return () => trace.push(`cleanup:${epoch}`);
      });
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    expect(trace).toEqual(["setup:0"]);

    advance?.();
    await waitFor(() => trace.includes("setup:1"));
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:1"]);
    advance?.();
    await waitFor(() => trace.includes("setup:2"));
    expect(trace.slice(-2)).toEqual(["cleanup:1", "setup:2"]);
    root.dispose();
    expect(trace.at(-1)).toBe("cleanup:2");
  });

  it("does not rerun an empty-dependency effect after a committed reevaluation", async () => {
    let advance: (() => void) | undefined;
    let evaluations = 0;
    const trace: string[] = [];

    function Model(): undefined {
      const [, setEpoch] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      advance = () => setEpoch((previous) => previous + 1);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      Behavon.useEffect(() => {
        trace.push("setup");
        return () => trace.push("cleanup");
      }, []);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    advance?.();
    await waitFor(() => evaluations === 2);
    expect(trace).toEqual(["setup"]);
    root.dispose();
    expect(trace).toEqual(["setup", "cleanup"]);
  });

  it("reruns a fixed-array effect only when a dependency changes by Object.is", async () => {
    let advance: (() => void) | undefined;
    let setDependency: ((value: number) => void) | undefined;
    let evaluations = 0;
    const trace: string[] = [];
    const label = (value: number) => Object.is(value, -0) ? "-0" : String(value);

    function Model(): undefined {
      const [dependency, setValue] = Behavon.useState(0);
      const [, setEpoch] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setDependency = setValue;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      advance = () => setEpoch((previous) => previous + 1);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      Behavon.useEffect(() => {
        trace.push(`setup:${label(dependency)}`);
        return () => trace.push(`cleanup:${label(dependency)}`);
      }, [dependency]);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    advance?.();
    await waitFor(() => evaluations === 2);
    expect(trace).toEqual(["setup:0"]);

    setDependency?.(-0);
    await waitFor(() => trace.includes("setup:-0"));
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:-0"]);

    advance?.();
    await waitFor(() => evaluations === 4);
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:-0"]);
    root.dispose();
    expect(trace.at(-1)).toBe("cleanup:-0");
  });

  it("does not activate an omitted-dependency effect from a failed evaluation", async () => {
    const failure = new Error("failed omitted-dependency evaluation");
    const trace: string[] = [];
    let fail: (() => void) | undefined;

    function Model(): undefined {
      const [shouldFail, setShouldFail] = Behavon.useState(false);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fail = () => setShouldFail(true);
      Behavon.useEffect(() => {
        trace.push(`setup:${shouldFail}`);
        return () => trace.push(`cleanup:${shouldFail}`);
      });
      if (shouldFail) throw failure;
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    const surfaced = await captureScheduledFailure(() => fail?.());
    expect(surfaced).toBe(failure);
    expect(trace).toEqual(["setup:false", "cleanup:false"]);
    expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
  });

  it("updates getSnapshot without replacing a stable external-store subscription", async () => {
    let current = 1;
    let getterOffset = 0;
    let useSecondSubscribe = false;
    let advance: (() => void) | undefined;
    let evaluations = 0;
    let subscribeCount = 0;
    let unsubscribeCount = 0;
    const listeners = new Set<() => void>();
    const values: number[] = [];
    const subscribe = (listener: () => void) => {
      subscribeCount += 1;
      listeners.add(listener);
      return () => {
        unsubscribeCount += 1;
        listeners.delete(listener);
      };
    };
    const secondSubscribe = (listener: () => void) => subscribe(listener);
    const firstGetter = () => current;
    const secondGetter = () => current + getterOffset;

    function Model(): undefined {
      const [, setEpoch] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      advance = () => setEpoch((previous) => previous + 1);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      const value = Behavon.useSyncExternalStore(
        useSecondSubscribe ? secondSubscribe : subscribe,
        getterOffset === 0 ? firstGetter : secondGetter,
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      values.push(value);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    expect({ subscribeCount, unsubscribeCount, evaluations, values }).toEqual({
      subscribeCount: 1,
      unsubscribeCount: 0,
      evaluations: 1,
      values: [1],
    });

    getterOffset = 100;
    advance?.();
    await waitFor(() => evaluations === 2);
    expect(values.at(-1)).toBe(101);
    expect(subscribeCount).toBe(1);
    expect(unsubscribeCount).toBe(0);

    current = 2;
    for (const listener of [...listeners]) listener();
    await waitFor(() => evaluations === 3);
    expect(values.at(-1)).toBe(102);
    expect(subscribeCount).toBe(1);
    expect(unsubscribeCount).toBe(0);

    for (const listener of [...listeners]) listener();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(evaluations).toBe(3);

    useSecondSubscribe = true;
    advance?.();
    await waitFor(() => subscribeCount === 2);
    expect(unsubscribeCount).toBe(1);
    expect(listeners.size).toBe(1);
    root.dispose();
    expect(unsubscribeCount).toBe(2);
    expect(listeners.size).toBe(0);
  });

  it("rejects a cross-root useModel updater before enqueueing or invoking it", async () => {
    let setInput: ((update: number | ((previous: number) => number)) => void) | undefined;
    let updaterCalls = 0;
    const childInputs: number[] = [];

    function Child(input: number): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      childInputs.push(input);
      return undefined;
    }

    const child = Behavon.createModel(Child, 1);
    function Target(): undefined {
      const [, setter] = Behavon.useModel(child);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setInput = setter;
      return undefined;
    }

    const target = Behavon.createModel(Target, undefined);
    function Source(): undefined {
      setInput?.((previous) => {
        updaterCalls += 1;
        return previous + 1;
      });
      return undefined;
    }

    expect(() => Behavon.createModel(Source, undefined)).toThrow(
      /Behavon\.useModel setter for target Model#\d+ cannot be called while evaluating source Model#\d+/,
    );
    expect(updaterCalls).toBe(0);
    expect(childInputs).toEqual([1]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(childInputs).toEqual([1]);

    setInput?.((previous) => previous + 2);
    await waitFor(() => childInputs.at(-1) === 3);
    expect(updaterCalls).toBe(0);
    target.dispose();
    child.dispose();
  });

  it("rejects a different-root setter from updater evaluation and keeps the target unscheduled", async () => {
    let setSource: ((update: number | ((previous: number) => number)) => void) | undefined;
    let setTarget: ((value: number) => void) | undefined;
    let updaterCalls = 0;
    const targetValues: number[] = [];

    function Target(): undefined {
      const [value, setter] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setTarget = setter;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      targetValues.push(value);
      return undefined;
    }

    function Source(): undefined {
      const [, setter] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setSource = setter;
      return undefined;
    }

    const target = Behavon.createModel(Target, undefined);
    const source = Behavon.createModel(Source, undefined);
    const surfaced = await captureScheduledFailure(() => setSource?.((previous) => {
      updaterCalls += 1;
      setTarget?.(1);
      return previous + 1;
    }));
    expect(String(surfaced)).toMatch(
      /Behavon\.useState setter for target Model#\d+ cannot be called while evaluating source Model#\d+/,
    );
    expect(updaterCalls).toBe(1);
    expect(targetValues).toEqual([0]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(targetValues).toEqual([0]);
    expect(() => Behavon.getInterface(source)).toThrow(/disposed/);
    target.dispose();
  });

  it("reports cross-Model evaluation before applying the disposed-target no-op policy", () => {
    let disposedSetter: ((value: number) => void) | undefined;

    function Target(): undefined {
      const [, setter] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disposedSetter = setter;
      return undefined;
    }

    const target = Behavon.createModel(Target, undefined);
    target.dispose();
    expect(() => disposedSetter?.(1)).not.toThrow();

    function Source(): undefined {
      disposedSetter?.(2);
      return undefined;
    }

    expect(() => Behavon.createModel(Source, undefined)).toThrow(
      /Behavon\.useState setter for target Model#\d+ cannot be called while evaluating source Model#\d+/,
    );
  });

  it("allows cross-Model setters from effects and managed callbacks outside evaluation", async () => {
    interface SourceEndpoints {
      readonly updateTarget: Signal<readonly [value: number]>;
    }
    let setTarget: ((value: number) => void) | undefined;
    const targetValues: number[] = [];

    function Target(): undefined {
      const [value, setter] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setTarget = setter;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      targetValues.push(value);
      return undefined;
    }

    const target = Behavon.createModel(Target, undefined);
    type SourcePortType = { "updateTarget": PortOnlySignal<any> };
    const sourcePort = Behavon.createPort<SourcePortType>({ "updateTarget": Behavon.SignalType() });
    function Source(): undefined {
      Behavon.useEffect(() => {
        setTarget?.(1);
      }, []);
      const updateTarget = Behavon.useCallback((value: number) => setTarget?.(value), []);
      Behavon.useSignal(sourcePort, "updateTarget", updateTarget);
      Behavon.useExport(sourcePort, "updateTarget");
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePortType>), undefined);
    await waitFor(() => targetValues.at(-1) === 1);
    signalOf(source, "updateTarget")(2);
    await waitFor(() => targetValues.at(-1) === 2);
    source.dispose();
    target.dispose();
  });
});
