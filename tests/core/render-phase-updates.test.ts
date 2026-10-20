import { describe, expect, it } from "vitest";
import Behave from "behavon";
import type { Signal, StateSetter } from "behavon";
import { inspectSnapshotChannelForTests } from "../../src/internal/snapshot-channels";
import { uniqueChannel, waitFor } from "../helpers";

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

describe("self render-phase updates", () => {
  it("progresses construction retry memo and callback caches from the immediately previous attempt", () => {
    const cases = [
      { name: "A to A", dependencies: [0, 0], factoryRuns: 1, finalClosure: "0:0" },
      { name: "A to B to B", dependencies: [0, 1, 1], factoryRuns: 2, finalClosure: "1:1" },
      { name: "A to B to A", dependencies: [0, 1, 0], factoryRuns: 3, finalClosure: "0:2" },
    ] as const;

    for (const retryCase of cases) {
      let factoryRuns = 0;
      const memoValues: Array<Readonly<{ dependency: number; attempt: number }>> = [];
      const callbacks: Array<() => string> = [];

      function Model(): undefined {
        const [attempt, setAttempt] = Behave.useState(0);
        const dependency = retryCase.dependencies[attempt] as number;
        const memo = Behave.useMemo(() => {
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe counts retry-local memo factory execution
          factoryRuns += 1;
          return { dependency, attempt } as const;
        // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only retry cache probe intentionally keys the value only by the selected dependency
        }, [dependency]);
        // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only retry cache probe intentionally keys the closure only by the selected dependency
        const callback = Behave.useCallback(() => `${dependency}:${attempt}`, [dependency]);
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records retry-local identity progression
        memoValues.push(memo);
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records retry-local identity progression
        callbacks.push(callback);
        if (attempt < retryCase.dependencies.length - 1) setAttempt(attempt + 1);
        return undefined;
      }

      const root = Behave.createModel(Model, undefined);
      expect(factoryRuns, retryCase.name).toBe(retryCase.factoryRuns);
      expect(callbacks.at(-1)?.(), retryCase.name).toBe(retryCase.finalClosure);
      if (retryCase.name === "A to A") {
        expect(memoValues[1]).toBe(memoValues[0]);
        expect(callbacks[1]).toBe(callbacks[0]);
      } else if (retryCase.name === "A to B to B") {
        expect(memoValues[1]).not.toBe(memoValues[0]);
        expect(memoValues[2]).toBe(memoValues[1]);
        expect(callbacks[1]).not.toBe(callbacks[0]);
        expect(callbacks[2]).toBe(callbacks[1]);
      } else {
        expect(memoValues[2]).not.toBe(memoValues[0]);
        expect(memoValues[2]).not.toBe(memoValues[1]);
        expect(callbacks[2]).not.toBe(callbacks[0]);
        expect(callbacks[2]).not.toBe(callbacks[1]);
      }
      root.dispose();
    }
  });

  it("progresses active retry caches without promoting a discarded candidate into the next transaction", async () => {
    const cases = [
      { name: "A to A", dependencies: [0, 0], factoryRuns: 1, finalClosure: "0:-1" },
      { name: "A to B to B", dependencies: [0, 1, 1], factoryRuns: 2, finalClosure: "1:1" },
      { name: "A to B to A", dependencies: [0, 1, 0], factoryRuns: 3, finalClosure: "0:2" },
    ] as const;

    for (const retryCase of cases) {
      let factoryRuns = 0;
      let start: ((attempt: number) => void) | undefined;
      const memoValues: Array<Readonly<{ dependency: number; attempt: number }>> = [];
      const callbacks: Array<() => string> = [];

      function Model(): undefined {
        const [attempt, setAttempt] = Behave.useState(-1);
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe exposes a setter for an active retry transaction
        start = setAttempt;
        const dependency = attempt < 0 ? 0 : retryCase.dependencies[attempt] as number;
        const memo = Behave.useMemo(() => {
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe counts retry-local memo factory execution
          factoryRuns += 1;
          return { dependency, attempt } as const;
        // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only retry cache probe intentionally keys the value only by the selected dependency
        }, [dependency]);
        // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only retry cache probe intentionally keys the closure only by the selected dependency
        const callback = Behave.useCallback(() => `${dependency}:${attempt}`, [dependency]);
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records retry-local identity progression
        memoValues.push(memo);
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records retry-local identity progression
        callbacks.push(callback);
        if (attempt >= 0 && attempt < retryCase.dependencies.length - 1) setAttempt(attempt + 1);
        return undefined;
      }

      const root = Behave.createModel(Model, undefined);
      const committedMemo = memoValues[0];
      const committedCallback = callbacks[0];
      start?.(0);
      await waitFor(() => callbacks.length === retryCase.dependencies.length + 1);
      expect(factoryRuns, retryCase.name).toBe(retryCase.factoryRuns);
      expect(callbacks.at(-1)?.(), retryCase.name).toBe(retryCase.finalClosure);
      if (retryCase.name === "A to A") {
        expect(memoValues[1]).toBe(committedMemo);
        expect(memoValues[2]).toBe(committedMemo);
        expect(callbacks[1]).toBe(committedCallback);
        expect(callbacks[2]).toBe(committedCallback);
      } else if (retryCase.name === "A to B to B") {
        expect(memoValues[2]).not.toBe(committedMemo);
        expect(memoValues[3]).toBe(memoValues[2]);
        expect(callbacks[2]).not.toBe(committedCallback);
        expect(callbacks[3]).toBe(callbacks[2]);
      } else {
        expect(memoValues[3]).not.toBe(committedMemo);
        expect(memoValues[3]).not.toBe(memoValues[2]);
        expect(callbacks[3]).not.toBe(committedCallback);
        expect(callbacks[3]).not.toBe(callbacks[2]);
      }
      root.dispose();
    }

    let phase = "A";
    let update: StateSetter<number> | undefined;
    let leakProbeFactoryRuns = 0;
    const leakProbeMemos: Array<Readonly<{ phase: string }>> = [];
    const leakProbeCallbacks: Array<() => string> = [];

    function LeakProbe(): undefined {
      const [, setTick] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe exposes a setter for independent transactions
      update = setTick;
      const memo = Behave.useMemo(() => {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe counts candidate memo factories
        leakProbeFactoryRuns += 1;
        return { phase };
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only candidate cache probe uses an outer phase changed before an independently scheduled evaluation
      }, [phase]);
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only candidate cache probe uses an outer phase changed before an independently scheduled evaluation
      const callback = Behave.useCallback(() => phase, [phase]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records candidate memo identity
      leakProbeMemos.push(memo);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records candidate callback identity
      leakProbeCallbacks.push(callback);
      return undefined;
    }

    const leakProbeRoot = Behave.createModel(LeakProbe, undefined);
    const committedMemo = leakProbeMemos[0];
    const committedCallback = leakProbeCallbacks[0];
    phase = "B";
    update?.((value) => value);
    await waitFor(() => leakProbeCallbacks.length === 2);
    expect(leakProbeCallbacks[1]).not.toBe(committedCallback);
    expect(leakProbeCallbacks[1]()).toBe("B");
    phase = "A";
    update?.((value) => value + 1);
    await waitFor(() => leakProbeCallbacks.length === 3);
    expect(leakProbeFactoryRuns).toBe(2);
    expect(leakProbeMemos[2]).toBe(committedMemo);
    expect(leakProbeCallbacks[2]).toBe(committedCallback);
    leakProbeRoot.dispose();
  });

  it("applies updater-enqueued state suffixes once without replaying the processed prefix", () => {
    const evaluations: number[] = [];
    const updaterOrder: string[] = [];

    function Model(): undefined {
      const [value, setValue] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations.push(value);
      if (value === 0) {
        setValue((previous) => {
          updaterOrder.push("prefix");
          setValue((suffixPrevious) => {
            updaterOrder.push("suffix");
            return suffixPrevious + 1;
          });
          return previous + 1;
        });
      }
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(evaluations).toEqual([0, 1, 2]);
    expect(updaterOrder).toEqual(["prefix", "suffix"]);
    root.dispose();
  });

  it("discards failed active state suffixes before terminal root cleanup", async () => {
    interface Endpoints {
      readonly start: Signal;
    }

    const failure = new Error("active state retry failed");
    const evaluations: number[] = [];
    const setups: number[] = [];
    let externalUpdaterCalls = 0;

    function Model(): undefined {
      const [value, setValue] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations.push(value);
      if (value === 1) setValue((previous) => previous + 1);
      if (value === 2) {
        setValue((previous) => previous + 1);
        throw failure;
      }
      const start = Behave.useCallback(() => setValue((previous) => {
        externalUpdaterCalls += 1;
        return previous + 1;
      }), [setValue]);
      Behave.useSignal("start", start);
      Behave.useEffect(() => {
        setups.push(value);
      }, [value]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.start())).toBe(failure);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(evaluations).toEqual([0, 1, 2]);
    expect(setups).toEqual([0]);
    expect(externalUpdaterCalls).toBe(1);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("does not reclassify a post-commit Effect update as an evaluation suffix before terminal teardown", async () => {
    interface Endpoints {
      readonly advance: Signal;
    }

    const failure = new Error("effect setup failed after scheduling state");
    const evaluations: Array<readonly [number, number]> = [];

    function Model(): undefined {
      const [value, setValue] = Behave.useState(0);
      const [phase, setPhase] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations.push([value, phase]);
      Behave.useEffect(() => {
        if (phase === 1) {
          setValue(5);
          throw failure;
        }
      }, [phase]);
      const advance = Behave.useCallback(() => setPhase(1), [setPhase]);
      Behave.useSignal("advance", advance);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.advance())).toBe(failure);
    await Promise.resolve();
    expect(evaluations).toEqual([[0, 0], [0, 1]]);
    expect(() => root.advance()).toThrow(/disposed/);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
  });

  it("does not activate a subscription selected only by a discarded attempt", async () => {
    interface Endpoints {
      readonly advance: Signal;
    }

    const subscriptions = [0, 0, 0];
    const unsubscriptions = [0, 0, 0];
    const subscribeFunctions = subscriptions.map((_count, index) => (_listener: () => void) => {
      subscriptions[index] += 1;
      return () => {
        unsubscriptions[index] += 1;
      };
    });

    function Model(): undefined {
      const [phase, setPhase] = Behave.useState(0);
      if (phase === 1) setPhase(2);
      Behave.useSyncExternalStore(
        subscribeFunctions[phase] as (listener: () => void) => () => void,
        () => phase,
      );
      const advance = Behave.useCallback(() => setPhase(1), [setPhase]);
      Behave.useSignal("advance", advance);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(subscriptions).toEqual([1, 0, 0]);
    root.advance();
    await waitFor(() => subscriptions[2] === 1);
    expect(subscriptions).toEqual([1, 0, 1]);
    expect(unsubscriptions).toEqual([1, 0, 0]);
    root.dispose();
    expect(unsubscriptions).toEqual([1, 0, 1]);
  });

  it("stops unconditional same-value construction updates after 25 attempts and releases candidates", () => {
    const channel = uniqueChannel("render-phase-limit");
    let evaluations = 0;

    function Loop(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      const [, setValue] = Behave.useState(0);
      Behave.useSnapshot(channel);
      setValue(0);
      return undefined;
    }

    expect(() => Behave.createModel(Loop, undefined)).toThrow(
      /Behave Model#\d+ exceeded 25 render-phase evaluation attempts/,
    );
    expect(evaluations).toBe(25);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("applies the same 25-attempt limit to an active Model reevaluation", async () => {
    interface Endpoints {
      readonly enableLoop: Signal;
    }

    let evaluations = 0;
    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      const [enabled, setEnabled] = Behave.useState(false);
      if (enabled) setEnabled(true);
      const enableLoop = Behave.useCallback(() => setEnabled(true), [setEnabled]);
      Behave.useSignal("enableLoop", enableLoop);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => root.enableLoop())).toMatchObject({
      message: expect.stringMatching(/Behave Model#\d+ exceeded 25 render-phase evaluation attempts/),
    });
    expect(evaluations).toBe(26);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });

  it("keeps hook count enforcement across construction retries", () => {
    function Broken(): undefined {
      const [value, setValue] = Behave.useState(0);
      if (value === 0) setValue(1);
      // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- test-only runtime hook-count probe intentionally discards a conditional memo with incomplete dependencies
      if (value === 1) Behave.useMemo(() => value, []);
      return undefined;
    }

    expect(() => Behave.createModel(Broken, undefined)).toThrow(
      /Behave hook count changed in Model#\d+: expected 1, received 2/,
    );
  });

  it("keeps hook order and dependency shape enforcement across construction retries", () => {
    function WrongOrder(): undefined {
      const [value, setValue] = Behave.useState(0);
      if (value === 0) {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- test-only runtime hook-order probe intentionally discards a memo with incomplete dependencies
        Behave.useMemo(() => value, []);
        setValue(1);
      } else {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- test-only runtime hook-order probe intentionally discards a callback with incomplete dependencies
        Behave.useCallback(() => value, []);
      }
      return undefined;
    }

    function WrongDependencies(): undefined {
      const [value, setValue] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- test-only dependency-shape probe needs a dynamic list and incomplete branch
      Behave.useMemo(() => value, value === 0 ? [] : [value]);
      if (value === 0) setValue(1);
      return undefined;
    }

    expect(() => Behave.createModel(WrongOrder, undefined)).toThrow(
      /Behave hook order changed in Model#\d+: expected memo, received callback/,
    );
    expect(() => Behave.createModel(WrongDependencies, undefined)).toThrow(
      /Behave\.useMemo dependency shape changed in Model#\d+ at hook index 1: expected array\(length 0\), received array\(length 1\)/,
    );
  });
});
