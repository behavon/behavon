import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { MutableHandle, Signal } from "behavon";
import {
  inspectModelInstanceForTests,
  inspectRetainedOperationForTests,
} from "../../src/internal/model-inspection";
import { waitFor, signalOf } from "../helpers";

async function captureScheduledFailure(action: () => void): Promise<unknown> {
  let surfaced: unknown;
  const originalEmit = process.emit;
  process.emit = ((event: string | symbol, ...args: unknown[]) => {
    if (event !== "uncaughtException") return Reflect.apply(originalEmit, process, [event, ...args]) as boolean;
    const error = args[0];
    surfaced = error;
    return true;
  }) as typeof process.emit;
  try {
    action();
    await Promise.resolve();
  } finally {
    process.emit = originalEmit;
  }
  return surfaced;
}

describe("useMutable", () => {
  it("keeps one immediate non-reactive cell across owner reevaluation", async () => {
    interface Endpoints {
      readonly reevaluate: Signal;
    }
    let evaluations = 0;
    type ModelPortType = { "reevaluate": PortOnlySignal<any> };
    const modelPort = Behavon.createPort<ModelPortType>({ "reevaluate": Behavon.SignalType() });
    function Model(initial: number): Readonly<{ mutable: MutableHandle<number>; revision: number }> {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe counts owner reevaluations
      evaluations += 1;
      const mutable = Behavon.useMutable(initial);
      const [revision, setRevision] = Behavon.useState(0);
      const reevaluate = Behavon.useCallback(() => setRevision(current => current + 1), [setRevision]);
      Behavon.useSignal(modelPort, "reevaluate", reevaluate);
      Behavon.useExport(modelPort, "reevaluate");
      return { mutable, revision };
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPortType>), 1);
    const initialOutput = inspectModelInstanceForTests(root).output as ReturnType<typeof Model>;
    const handle = initialOutput.mutable;
    expect(Object.isFrozen(handle)).toBe(true);
    expect("current" in handle).toBe(false);
    handle.set(2);
    handle.set(current => current + 3);
    expect(handle.get()).toBe(5);
    expect(evaluations).toBe(1);

    signalOf(root, "reevaluate")();
    await waitFor(() => evaluations === 2);
    const nextOutput = inspectModelInstanceForTests(root).output as ReturnType<typeof Model>;
    expect(nextOutput.mutable).toBe(handle);
    expect(nextOutput.mutable.get()).toBe(5);
    expect(nextOutput.revision).toBe(1);
    root.dispose();
  });

  it("stores a function initial value without invoking it and preserves the value when an updater throws", () => {
    let initialCalls = 0;
    const initial = () => {
      initialCalls += 1;
      return 42;
    };
    function Model(): MutableHandle<typeof initial> {
      const mutable = Behavon.useMutable(initial);
      return mutable;
    }

    const root = Behavon.createModel(Model, undefined);
    const handle = inspectModelInstanceForTests(root).output as MutableHandle<typeof initial>;
    expect(initialCalls).toBe(0);
    expect(handle.get()).toBe(initial);
    const original = new Error("updater failed");
    expect(() => handle.set(() => {
      throw original;
    })).toThrow(original);
    expect(handle.get()).toBe(initial);
    expect(initialCalls).toBe(0);
    root.dispose();
  });

  it("allows cleanup access, then terminalizes both methods and releases their retained target", () => {
    const cleanupValues: number[] = [];
    function Model(): MutableHandle<number> {
      const mutable = Behavon.useMutable(1);
      Behavon.useEffect(() => () => {
        cleanupValues.push(mutable.get());
        mutable.set(2);
        cleanupValues.push(mutable.get());
      }, []);
      return mutable;
    }

    const root = Behavon.createModel(Model, undefined);
    const handle = inspectModelInstanceForTests(root).output as MutableHandle<number>;
    const getTarget = inspectRetainedOperationForTests(handle.get);
    const setTarget = inspectRetainedOperationForTests(handle.set);
    expect(getTarget).toBe(setTarget);
    expect(getTarget.kind).toBe("mutableHandle");
    expect(getTarget.cell).toBeDefined();
    root.dispose();
    expect(cleanupValues).toEqual([1, 2]);
    expect(getTarget.cell).toBeUndefined();
    expect((getTarget.owner as { status: string }).status).toBe("disposed");
    const terminal = "Behavon.useMutable handle requires a live Model instance";
    expect(() => handle.get()).toThrow(terminal);
    expect(() => handle.set(3)).toThrow(terminal);
  });

  it("does not roll an evaluation-time write back before failure cleanup", async () => {
    interface Endpoints {
      readonly fail: Signal;
    }
    let cleanupValue: number | undefined;
    type ModelPort1Type = { "fail": PortOnlySignal<any> };
    const modelPort1 = Behavon.createPort<ModelPort1Type>({ "fail": Behavon.SignalType() });
    function Model(): MutableHandle<number> {
      const mutable = Behavon.useMutable(0);
      const [failed, setFailed] = Behavon.useState(false);
      Behavon.useEffect(() => () => {
        cleanupValue = mutable.get();
      }, []);
      if (failed) {
        mutable.set(9);
        throw new Error("evaluation failed after mutable write");
      }
      const fail = Behavon.useCallback(() => setFailed(true), [setFailed]);
      Behavon.useSignal(modelPort1, "fail", fail);
      Behavon.useExport(modelPort1, "fail");
      return mutable;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort1Type>), undefined);
    const handle = inspectModelInstanceForTests(root).output as MutableHandle<number>;
    const failure = await captureScheduledFailure(() => signalOf(root, "fail")());
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("evaluation failed after mutable write");
    expect(cleanupValue).toBe(9);
    expect(() => handle.get()).toThrow("Behavon.useMutable handle requires a live Model instance");
  });

  it("terminalizes a handle that escaped failed construction", () => {
    let escaped: MutableHandle<number> | undefined;
    function Model(): undefined {
      const mutable = Behavon.useMutable(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a failed-construction Hook result
      escaped = mutable;
      throw new Error("construction failed");
    }

    expect(() => Behavon.createModel(Model, undefined)).toThrow("construction failed");
    expect(() => escaped?.get()).toThrow("Behavon.useMutable handle requires a live Model instance");
    expect(() => escaped?.set(1)).toThrow("Behavon.useMutable handle requires a live Model instance");
  });

  it("participates in Hook order diagnostics", async () => {
    interface Endpoints {
      readonly enable: Signal;
    }
    type ModelPort2Type = { "enable": PortOnlySignal<any> };
    const modelPort2 = Behavon.createPort<ModelPort2Type>({ "enable": Behavon.SignalType() });
    function Model(): undefined {
      const [enabled, setEnabled] = Behavon.useState(false);
      if (enabled) {
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api -- test-only probe verifies runtime Hook-order rejection
        const mutable = Behavon.useMutable(0);
        void mutable;
      }
      const enable = Behavon.useCallback(() => setEnabled(true), [setEnabled]);
      Behavon.useSignal(modelPort2, "enable", enable);
      Behavon.useExport(modelPort2, "enable");
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort2Type>), undefined);
    const failure = await captureScheduledFailure(() => signalOf(root, "enable")());
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(
      /^Behavon hook order changed in Model#\d+: expected callback, received mutable$/,
    );
  });
});
