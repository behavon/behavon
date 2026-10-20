import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { BoundaryState, ModelInstance, Signal, StateSetter } from "behavon";
import { waitFor, signalOf } from "../helpers";

function observeBoundary<Input, Output>(instance: ModelInstance<Input, BoundaryState<Output>>) {
  let state: BoundaryState<Output> | undefined;
  let setInput: StateSetter<Input> | undefined;
  function Observer(): undefined {
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
    [state, setInput] = Behavon.useModel(instance);
    return undefined;
  }
  const observer = Behavon.createModel(Observer, undefined);
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

describe("React-aligned commit-phase lifecycle", () => {
  it("runs interleaved Hook cleanups and setups in declaration order across kinds", async () => {
    const trace: string[] = [];
    let replace: (() => void) | undefined;

    const subscribe = (version: number) => (_listener: () => void): (() => void) => {
      trace.push(`subscribe:${version}`);
      return () => trace.push(`unsubscribe:${version}`);
    };

    function Model(): undefined {
      const [version, setVersion] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      replace = () => setVersion(1);
      Behavon.useEffect(() => {
        trace.push(`first setup:${version}`);
        return () => trace.push(`first cleanup:${version}`);
      }, [version]);
      Behavon.useSyncExternalStore(subscribe(version), () => version);
      Behavon.useEffect(() => {
        trace.push(`second setup:${version}`);
        return () => trace.push(`second cleanup:${version}`);
      }, [version]);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    expect(trace).toEqual(["first setup:0", "subscribe:0", "second setup:0"]);
    replace?.();
    await waitFor(() => trace.includes("second setup:1"));
    expect(trace).toEqual([
      "first setup:0",
      "subscribe:0",
      "second setup:0",
      "first cleanup:0",
      "unsubscribe:0",
      "second cleanup:0",
      "first setup:1",
      "subscribe:1",
      "second setup:1",
    ]);
    root.dispose();
  });

  it("continues the whole pass and projects same-Boundary errors in encounter order", async () => {
    const cleanupFailure = new Error("first cleanup");
    const setupFailure = new Error("first setup");
    const trace: string[] = [];

    function Child(input: number): undefined {
      Behavon.useEffect(() => {
        trace.push(`first setup:${input}`);
        if (input === 1) throw setupFailure;
        return () => {
          trace.push(`first cleanup:${input}`);
          if (input === 0) throw cleanupFailure;
        };
      }, [input]);
      Behavon.useEffect(() => {
        trace.push(`second setup:${input}`);
        return () => trace.push(`second cleanup:${input}`);
      }, [input]);
      return undefined;
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), 0);
    const observed = observeBoundary(instance);
    observed.setInput(1);
    await waitFor(() => observed.state.status === "failed");
    expect(trace).toEqual([
      "first setup:0",
      "second setup:0",
      "first cleanup:0",
      "second cleanup:0",
      "first setup:1",
      "second setup:1",
      "second cleanup:1",
    ]);
    const error = observed.state.status === "failed" ? observed.state.error : undefined;
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([cleanupFailure, setupFailure]);
    observed.dispose();
    instance.dispose();
  });

  it("commits different Boundary failures in controller call order", async () => {
    const firstFailure = new Error("first");
    const secondFailure = new Error("second");
    const trace: string[] = [];

    function Child(input: { label: string; fail: boolean }): undefined {
      Behavon.useEffect(() => {
        if (input.fail) {
          trace.push(`fail:${input.label}`);
          throw input.label === "first" ? firstFailure : secondFailure;
        }
        return () => trace.push(`dispose:${input.label}`);
      }, [input.fail, input.label]);
      return undefined;
    }

    const first = Behavon.createModel(Behavon.boundary(Child), { label: "first", fail: false });
    const second = Behavon.createModel(Behavon.boundary(Child), { label: "second", fail: false });
    const firstObserved = observeBoundary(first);
    const secondObserved = observeBoundary(second);
    function Controller(): undefined {
      const fail = Behavon.useCallback(() => {
        firstObserved.setInput({ label: "first", fail: true });
        secondObserved.setInput({ label: "second", fail: true });
      }, []);
      Behavon.useSignal("fail", fail);
      return undefined;
    }

    const controller = Behavon.createModel(Controller, undefined);
    signalOf(controller, "fail")();
    await waitFor(() => firstObserved.state.status === "failed" && secondObserved.state.status === "failed");
    expect(trace).toEqual([
      "dispose:first",
      "fail:first",
      "dispose:second",
      "fail:second",
    ]);
    expect(firstObserved.state.status).toBe("failed");
    expect(secondObserved.state.status).toBe("failed");
    expect(firstObserved.state.status === "failed" ? firstObserved.state.error : undefined).toBe(firstFailure);
    expect(secondObserved.state.status === "failed" ? secondObserved.state.error : undefined).toBe(secondFailure);
    controller.dispose();
    secondObserved.dispose();
    firstObserved.dispose();
    second.dispose();
    first.dispose();
  });

  it("keeps terminal cleanup errors in the Boundary containment cycle that triggered them", async () => {
    const setupFailure = new Error("replacement setup failed");
    const terminalCleanupFailure = new Error("failed Child terminal cleanup");
    let terminalCleanupCalls = 0;

    function Child(input: number): undefined {
      Behavon.useEffect(() => {
        if (input === 1) throw setupFailure;
      }, [input]);
      Behavon.useEffect(() => () => {
        terminalCleanupCalls += 1;
        throw terminalCleanupFailure;
      }, []);
      return undefined;
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), 0);
    const observed = observeBoundary(instance);
    observed.setInput(1);
    await waitFor(() => observed.state.status === "failed");
    const error = observed.state.status === "failed" ? observed.state.error : undefined;
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([setupFailure, terminalCleanupFailure]);
    expect(terminalCleanupCalls).toBe(1);

    expect(observed.state.status).toBe("failed");
    observed.dispose();
    instance.dispose();
    expect(terminalCleanupCalls).toBe(1);
  });

  it("aggregates root setup failures and terminal cleanup failure in encounter order", async () => {
    interface Endpoints { readonly fail: Signal }
    const firstSetupFailure = new Error("first setup");
    const secondSetupFailure = new Error("second setup");
    const terminalCleanupFailure = new Error("terminal cleanup");
    let setVersion: ((value: number) => void) | undefined;

    function Model(): undefined {
      const [version, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setVersion = setValue;
      Behavon.useEffect(() => {
        if (version === 1) throw firstSetupFailure;
      }, [version]);
      Behavon.useEffect(() => {
        if (version === 1) throw secondSetupFailure;
      }, [version]);
      Behavon.useEffect(() => () => {
        throw terminalCleanupFailure;
      }, []);
      const fail = Behavon.useCallback(() => setValue(1), [setValue]);
      Behavon.useSignal("fail", fail);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
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
      signalOf(root, "fail")();
      await Promise.resolve();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(surfaced).toBeInstanceOf(AggregateError);
    expect((surfaced as AggregateError).errors).toEqual([
      firstSetupFailure,
      secondSetupFailure,
      terminalCleanupFailure,
    ]);
    expect(() => root.dispose()).toThrow(/dispose\(\) called more than once/);
    expect(setVersion).toBeDefined();
  });

  it("treats notification and post-subscribe read failures as changed checks", async () => {
    const listeners = new Set<() => void>();
    const observed: number[] = [];
    let reads = 0;
    let value = 0;
    let failNextCheck = true;
    const subscribe = (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const getSnapshot = (): number => {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      reads += 1;
      if (failNextCheck && reads === 2) {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
        failNextCheck = false;
        throw new Error("temporary post-subscribe check");
      }
      return value;
    };

    function Model(): undefined {
      const observedValue = Behavon.useSyncExternalStore(subscribe, getSnapshot);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      observed.push(observedValue);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    await waitFor(() => reads >= 3);
    expect(observed).toEqual([0, 0]);
    failNextCheck = true;
    reads = 1;
    expect(() => listeners.forEach((listener) => listener())).not.toThrow();
    value = 1;
    await waitFor(() => observed.at(-1) === 1);
    expect(listeners.size).toBe(1);
    root.dispose();
  });
});
