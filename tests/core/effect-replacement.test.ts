import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { Signal, Slot, UntypedModelRef } from "behavon";
import { inspectSnapshotChannelForTests } from "../../src/internal/snapshot-channels";
import { uniqueChannel, waitFor, signalOf } from "../helpers";

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

describe("Effect replacement failure bookkeeping", () => {
  it("replaces a successful cleanup resource before installing the new one", async () => {
    const trace: string[] = [];
    let setVersion: ((value: number) => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      Behavon.useEffect(() => {
        trace.push(`setup:${version}`);
        return () => trace.push(`cleanup:${version}`);
      }, [version]);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    setVersion?.(1);
    await waitFor(() => trace.includes("setup:1"));
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:1"]);
    root.dispose();
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:1", "cleanup:1"]);
  });

  it("continues setup after a consumed cleanup throws and aggregates later teardown failure", async () => {
    const cleanupFailure = new Error("replacement cleanup failed");
    const replacementTerminalCleanupFailure = new Error("replacement terminal cleanup failed");
    let cleanupCalls = 0;
    let setupCalls = 0;
    let setVersion: ((value: number) => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      Behavon.useEffect(() => {
        setupCalls += 1;
        return () => {
          cleanupCalls += 1;
          if (cleanupCalls === 1) throw cleanupFailure;
          throw replacementTerminalCleanupFailure;
        };
      }, [version]);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    const surfaced = await captureScheduledFailure(() => setVersion?.(1));
    expect(surfaced).toBeInstanceOf(AggregateError);
    expect((surfaced as AggregateError).errors).toEqual([cleanupFailure, replacementTerminalCleanupFailure]);
    expect({ setupCalls, cleanupCalls }).toEqual({ setupCalls: 2, cleanupCalls: 2 });
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
  });

  it("records a setup failure without inventing a cleanup and terminalizes instead of retrying", async () => {
    const setupFailure = new Error("replacement setup failed");
    const trace: string[] = [];
    let setVersion: ((value: number) => void) | undefined;
    let advance: (() => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      const [, setEpoch] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      advance = () => setEpoch((epoch) => epoch + 1);
      Behavon.useEffect(() => {
        trace.push(`setup:${version}`);
        if (version === 1) throw setupFailure;
        return () => trace.push(`cleanup:${version}`);
      }, [version]);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    const surfaced = await captureScheduledFailure(() => setVersion?.(1));
    expect(surfaced).toBe(setupFailure);
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:1"]);

    advance?.();
    await waitFor(() => trace.length === 3);
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:1"]);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
  });

  it("continues later changed Effects after an external-store activation failure", async () => {
    const subscribeFailure = new Error("replacement subscribe failed");
    const trace: string[] = [];
    let setVersion: ((value: number) => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      const subscribe = version === 0
        ? (_listener: () => void) => () => undefined
        : (_listener: () => void) => { throw subscribeFailure; };
      Behavon.useSyncExternalStore(subscribe, () => version);
      Behavon.useEffect(() => {
        trace.push(`setup:${version}`);
        return () => trace.push(`cleanup:${version}`);
      }, [version]);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    const surfaced = await captureScheduledFailure(() => setVersion?.(1));
    expect(surfaced).toBe(subscribeFailure);
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:1", "cleanup:1"]);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
  });

  it("continues later changed Effects after an earlier Effect setup failure", async () => {
    const setupFailure = new Error("first Effect replacement failed");
    const trace: string[] = [];
    let setVersion: ((value: number) => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      Behavon.useEffect(() => {
        trace.push(`first setup:${version}`);
        if (version === 1) throw setupFailure;
      }, [version]);
      Behavon.useEffect(() => {
        trace.push(`second setup:${version}`);
        return () => trace.push(`second cleanup:${version}`);
      }, [version]);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    const surfaced = await captureScheduledFailure(() => setVersion?.(1));
    expect(surfaced).toBe(setupFailure);
    expect(trace).toEqual([
      "first setup:0",
      "second setup:0",
      "second cleanup:0",
      "first setup:1",
      "second setup:1",
      "second cleanup:1",
    ]);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
  });

  it("does not install a replacement after its cleanup disposes the owner", async () => {
    const trace: string[] = [];
    let root: UntypedModelRef | undefined;
    let setVersion: ((value: number) => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      Behavon.useEffect(() => {
        trace.push(`setup:${version}`);
        return () => {
          trace.push(`cleanup:${version}`);
          if (version === 0) root?.dispose();
        };
      }, [version]);
      return undefined;
    }

    root = Behavon.createModel(Model, undefined);
    setVersion?.(1);
    await waitFor(() => trace.includes("cleanup:0"));
    expect(trace).toEqual(["setup:0", "cleanup:0"]);
  });

  it("balances a cleanup returned after setup disposes its owner", async () => {
    const trace: string[] = [];
    let root: UntypedModelRef | undefined;
    let setVersion: ((value: number) => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      Behavon.useEffect(() => {
        trace.push(`setup:${version}`);
        if (version === 1) root?.dispose();
        return () => trace.push(`cleanup:${version}`);
      }, [version]);
      return undefined;
    }

    root = Behavon.createModel(Model, undefined);
    setVersion?.(1);
    await waitFor(() => trace.includes("cleanup:1"));
    expect(trace).toEqual(["setup:0", "cleanup:0", "setup:1", "cleanup:1"]);
  });

  it("surfaces a balancing cleanup failure after setup disposes its owner", async () => {
    const cleanupFailure = new Error("balancing cleanup failed");
    let root: UntypedModelRef | undefined;
    let setVersion: ((value: number) => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      Behavon.useEffect(() => {
        if (version === 1) root?.dispose();
        return () => {
          if (version === 1) throw cleanupFailure;
        };
      }, [version]);
      return undefined;
    }

    root = Behavon.createModel(Model, undefined);
    const surfaced = await captureScheduledFailure(() => setVersion?.(1));
    expect(surfaced).toBe(cleanupFailure);
  });

  it("finishes terminal cleanup release after multiple cleanup throws and preserves the first error", () => {
    const firstFailure = new Error("first terminal cleanup failed");
    const secondFailure = new Error("second terminal cleanup failed");
    const trace: string[] = [];

    function Model(): undefined {
      Behavon.useEffect(() => () => {
        trace.push("first");
        throw firstFailure;
      }, []);
      Behavon.useEffect(() => () => {
        trace.push("second");
        throw secondFailure;
      }, []);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    expect(() => root.dispose()).toThrow(firstFailure);
    expect(trace).toEqual(["first", "second"]);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
  });
});

describe("Effect failure root terminality", () => {
  it("terminalizes root authorities, preserves publication, and keeps the original setup error", async () => {
    interface Endpoints {
      readonly trigger: Signal;
      readonly alive: Signal;
    }

    const channel = uniqueChannel("effect-terminal-publication");
    const setupFailure = new Error("effect setup failed");
    const terminalCleanupFailure = new Error("terminal cleanup failed");
    let triggerSetter: (() => void) | undefined;
    let unsubscribeCalls = 0;
    let independentCalls = 0;
    let evaluations = 0;
    let externalListener: (() => void) | undefined;
    const subscribe = (listener: () => void) => {
      externalListener = listener;
      return () => {
        unsubscribeCalls += 1;
      };
    };

    function Keeper(): undefined {
      Behavon.useSnapshot(channel);
      const alive = Behavon.useCallback(() => {
        independentCalls += 1;
      }, []);
      Behavon.useSignal("alive", alive);
      return undefined;
    }

    const keeper = Behavon.createModel(Keeper, undefined);

    function Failing(): undefined {
      const [phase, setPhase] = Behavon.useState(0);
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      triggerSetter = () => setPhase(1);
      Behavon.useSyncExternalStore(subscribe, () => phase);
      Behavon.useEffect(() => {
        if (phase === 1) throw setupFailure;
      }, [phase]);
      Behavon.useEffect(() => () => {
        throw terminalCleanupFailure;
      }, []);
      const trigger = Behavon.useCallback(() => {
        publish(7);
        setPhase(1);
      }, [publish, setPhase]);
      Behavon.useSignal("trigger", trigger);
      return undefined;
    }

    const root = Behavon.createModel(Failing, undefined);
    const retainedTrigger = signalOf(root, "trigger");
    const surfaced = await captureScheduledFailure(() => signalOf(root, "trigger")());

    expect(surfaced).toBeInstanceOf(AggregateError);
    expect((surfaced as AggregateError).errors).toEqual([setupFailure, terminalCleanupFailure]);
    expect(unsubscribeCalls).toBe(1);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(7);
    expect(() => root.trigger()).toThrow(/disposed/);
    expect(() => retainedTrigger()).toThrow(/disposed/);
    expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
    triggerSetter?.();
    externalListener?.();
    await Promise.resolve();
    expect(evaluations).toBe(2);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);

    signalOf(keeper, "alive")();
    expect(independentCalls).toBe(1);
    keeper.dispose();
  });

  it("terminalizes a new Child first activation while preserving the Effect error over teardown errors", () => {
    const effectFailure = new Error("new Child Effect failed");
    const unsubscribeFailure = new Error("new Child unsubscribe failed");
    let unsubscribeCalls = 0;
    let independentCalls = 0;

    function Independent(): undefined {
      Behavon.useEffect(() => {
        independentCalls += 1;
      }, []);
      return undefined;
    }

    const independent = Behavon.createModel(Independent, undefined);

    function Child(): undefined {
      Behavon.useSyncExternalStore(
        () => () => {
          unsubscribeCalls += 1;
          throw unsubscribeFailure;
        },
        () => 0,
      );
      Behavon.useEffect(() => {
        throw effectFailure;
      }, []);
      return undefined;
    }

    let surfaced: unknown;
    try {
      Behavon.createModel(Child, undefined);
    } catch (error: unknown) {
      surfaced = error;
    }
    expect(surfaced).toBeInstanceOf(AggregateError);
    expect((surfaced as AggregateError).errors).toEqual([effectFailure, unsubscribeFailure]);
    expect(unsubscribeCalls).toBe(1);
    expect(independentCalls).toBe(1);
    independent.dispose();
  });
});
