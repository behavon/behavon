import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { Signal } from "behavon";
import { waitFor, signalOf } from "../helpers";

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

  it("aggregates root setup failures and terminal cleanup failure in encounter order", async () => {
    interface Endpoints { readonly fail: Signal }
    const firstSetupFailure = new Error("first setup");
    const secondSetupFailure = new Error("second setup");
    const terminalCleanupFailure = new Error("terminal cleanup");
    let setVersion: ((value: number) => void) | undefined;

    type ModelPortType = { "fail": PortOnlySignal<any> };
    const modelPort = Behavon.createPort<ModelPortType>({ "fail": Behavon.SignalType() });
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
      Behavon.useSignal(modelPort, "fail", fail);
      Behavon.useExport(modelPort, "fail");
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPortType>), undefined);
    let surfaced: unknown;
    const originalEmit = process.emit;
    process.emit = ((event: string | symbol, ...args: unknown[]) => {
      if (event !== "uncaughtException") return Reflect.apply(originalEmit, process, [event, ...args]) as boolean;
      const error = args[0];
      surfaced = error;
      return true;
    }) as typeof process.emit;
    try {
      signalOf(root, "fail")();
      await Promise.resolve();
    } finally {
      process.emit = originalEmit;
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
