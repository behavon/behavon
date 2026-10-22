import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { waitFor } from "../helpers";

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function captureScheduledFailure(trigger: () => void): Promise<unknown> {
  const originalEmit = process.emit;
  let surfaced: unknown;
  process.emit = ((event: string | symbol, ...args: unknown[]) => {
    if (event !== "uncaughtException") return Reflect.apply(originalEmit, process, [event, ...args]) as boolean;
    const error = args[0];
    surfaced = error;
    return true;
  }) as typeof process.emit;
  try {
    trigger();
    await Promise.resolve();
  } finally {
    process.emit = originalEmit;
  }
  return surfaced;
}

describe("external-store subscription replacement ownership", () => {
  it("consumes the old lease before a replacement subscribe and terminalizes on an unbounded failure", async () => {
    const failure = { source: "new subscribe" };
    const trace: string[] = [];
    let replace: (() => void) | undefined;

    const oldSubscribe = (_listener: () => void): (() => void) => {
      trace.push("old subscribe");
      return () => trace.push("old unsubscribe");
    };
    const newSubscribe = (_listener: () => void): (() => void) => {
      trace.push("new subscribe");
      throw failure;
    };

    function Model(): undefined {
      const [changed, setChanged] = Behavon.useState(false);
      Behavon.useSyncExternalStore(changed ? newSubscribe : oldSubscribe, () => 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      replace = () => setChanged(true);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => replace?.())).toBe(failure);
    expect(trace).toEqual(["old subscribe", "old unsubscribe", "new subscribe"]);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
  });

  it("continues replacement setup after an unsubscribe failure and never retries the consumed lease", async () => {
    const failure = { source: "old unsubscribe" };
    const trace: string[] = [];
    let replace: (() => void) | undefined;

    const oldSubscribe = (_listener: () => void): (() => void) => {
      trace.push("old subscribe");
      return () => {
        trace.push("old unsubscribe");
        throw failure;
      };
    };
    const newSubscribe = (_listener: () => void): (() => void) => {
      trace.push("new subscribe");
      return () => trace.push("new unsubscribe");
    };

    function Model(): undefined {
      const [changed, setChanged] = Behavon.useState(false);
      Behavon.useSyncExternalStore(changed ? newSubscribe : oldSubscribe, () => 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      replace = () => setChanged(true);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => replace?.())).toBe(failure);
    expect(trace).toEqual([
      "old subscribe",
      "old unsubscribe",
      "new subscribe",
      "new unsubscribe",
    ]);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
  });

  it("keeps the new lease active when the post-subscribe changed-check throws", async () => {
    const oldListeners = new Set<() => void>();
    const newListeners = new Set<() => void>();
    const observed: number[] = [];
    let oldCleanupCalls = 0;
    let newCleanupCalls = 0;
    let reads = 0;
    let value = 0;
    let replace: (() => void) | undefined;

    const oldSubscribe = (listener: () => void): (() => void) => {
      oldListeners.add(listener);
      return () => {
        oldCleanupCalls += 1;
        oldListeners.delete(listener);
      };
    };
    const newSubscribe = (listener: () => void): (() => void) => {
      newListeners.add(listener);
      return () => {
        newCleanupCalls += 1;
        newListeners.delete(listener);
      };
    };
    const nextSnapshot = (): number => {
      reads += 1;
      if (reads === 2) throw new Error("temporary changed-check failure");
      return value;
    };

    function Model(): undefined {
      const [changed, setChanged] = Behavon.useState(false);
      const observedValue = Behavon.useSyncExternalStore(
        changed ? newSubscribe : oldSubscribe,
        changed ? nextSnapshot : () => value,
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      observed.push(observedValue);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      replace = () => setChanged(true);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    replace?.();
    await waitFor(() => reads >= 3);
    expect(oldCleanupCalls).toBe(1);
    expect(oldListeners.size).toBe(0);
    expect(newListeners.size).toBe(1);
    value = 1;
    newListeners.forEach((listener) => listener());
    await waitFor(() => observed.at(-1) === 1);
    root.dispose();
    expect(newCleanupCalls).toBe(1);
  });

  it("keeps one subscription across getter-only changes and schedules only changed snapshots", async () => {
    const listeners = new Set<() => void>();
    let subscribeCalls = 0;
    let cleanupCalls = 0;
    let snapshot = 0;
    let evaluations = 0;
    let changeGetter: (() => void) | undefined;

    const subscribe = (listener: () => void): (() => void) => {
      subscribeCalls += 1;
      listeners.add(listener);
      return () => {
        cleanupCalls += 1;
        listeners.delete(listener);
      };
    };
    const firstGetter = (): number => snapshot;
    const secondGetter = (): number => snapshot;

    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      const [changed, setChanged] = Behavon.useState(false);
      Behavon.useSyncExternalStore(subscribe, changed ? secondGetter : firstGetter);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      changeGetter = () => setChanged(true);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    changeGetter?.();
    await waitFor(() => evaluations === 2);
    expect(subscribeCalls).toBe(1);
    listeners.forEach((listener) => listener());
    await settle();
    expect(evaluations).toBe(2);
    snapshot = 1;
    listeners.forEach((listener) => listener());
    await waitFor(() => evaluations === 3);
    root.dispose();
    expect(cleanupCalls).toBe(1);
  });

  it("keeps synchronous subscribe and post-read notifications pending until lease activation", async () => {
    const oldListeners = new Set<() => void>();
    const newListeners = new Set<() => void>();
    const observed: number[] = [];
    let oldCleanupCalls = 0;
    let newCleanupCalls = 0;
    let newReads = 0;
    let notifications = 0;
    let snapshot = 0;
    let evaluations = 0;
    let replace: (() => void) | undefined;

    const oldSubscribe = (listener: () => void): (() => void) => {
      oldListeners.add(listener);
      return () => {
        oldCleanupCalls += 1;
        oldListeners.delete(listener);
      };
    };
    const newSubscribe = (listener: () => void): (() => void) => {
      newListeners.add(listener);
      notifications += 1;
      listener();
      return () => {
        newCleanupCalls += 1;
        newListeners.delete(listener);
      };
    };
    const newGetter = (): number => {
      newReads += 1;
      if (newReads === 2) {
        snapshot = 2;
        newListeners.forEach((listener) => {
          notifications += 1;
          listener();
        });
      }
      return snapshot;
    };

    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      const [useReplacement, setUseReplacement] = Behavon.useState(false);
      const observedValue = Behavon.useSyncExternalStore(
        useReplacement ? newSubscribe : oldSubscribe,
        useReplacement ? newGetter : () => snapshot,
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      observed.push(observedValue);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      replace = () => setUseReplacement(true);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    replace?.();
    await waitFor(() => evaluations === 3);
    expect(newReads).toBe(3);
    expect(notifications).toBe(2);
    expect(observed).toEqual([0, 0, 2]);
    expect(oldCleanupCalls).toBe(1);
    expect(oldListeners.size).toBe(0);
    expect(newListeners.size).toBe(1);
    root.dispose();
    expect(newCleanupCalls).toBe(1);
    expect(newListeners.size).toBe(0);
  });
});
