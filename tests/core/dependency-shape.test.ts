import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { Signal } from "behavon";
import { signalOf } from "../helpers";

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

function expectShapeFailure(
  failure: unknown,
  api: "useMemo" | "useCallback" | "useEffect",
  expected: string,
  received: string,
  hookIndex = 1,
): void {
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toMatch(
    new RegExp(`^Behavon\\.${api} dependency shape changed in Model#\\d+ at hook index ${hookIndex}: expected ${expected}, received ${received}$`),
  );
}

describe("hook dependency shape invariants", () => {
  for (const api of ["useMemo", "useCallback", "useEffect"] as const) {
    it(`rejects a ${api} dependency length change`, async () => {
      interface Endpoints {
        readonly expand: Signal;
      }

      type ModelPortType = { "expand": PortOnlySignal<any> };
      const modelPort = Behavon.createPort<ModelPortType>({ "expand": Behavon.SignalType() });
      function Model(): undefined {
        const [expanded, setExpanded] = Behavon.useState(false);
        const dependencies = expanded ? [0, 1] : [0];
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        if (api === "useMemo") Behavon.useMemo(() => 1, dependencies);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        else if (api === "useCallback") Behavon.useCallback(() => undefined, dependencies);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        else Behavon.useEffect(() => undefined, dependencies);
        const expand = Behavon.useCallback(() => setExpanded(true), [setExpanded]);
        Behavon.useSignal(modelPort, "expand", expand);
        Behavon.useExport(modelPort, "expand");
        return undefined;
      }

      const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPortType>), undefined);
      const failure = await captureScheduledFailure(() => signalOf(root, "expand")());
      expectShapeFailure(failure, api, "array\\(length 1\\)", "array\\(length 2\\)");
      expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
    });
  }

  for (const api of ["useMemo", "useCallback", "useEffect"] as const) {
    it(`rejects an in-place ${api} dependency length change`, async () => {
      interface Endpoints {
        readonly expand: Signal;
      }
      const dependencies: unknown[] = [0];

      type ModelPort1Type = { "expand": PortOnlySignal<any> };
      const modelPort1 = Behavon.createPort<ModelPort1Type>({ "expand": Behavon.SignalType() });
      function Model(): undefined {
        const [, setEpoch] = Behavon.useState(0);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        if (api === "useMemo") Behavon.useMemo(() => 1, dependencies);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        else if (api === "useCallback") Behavon.useCallback(() => undefined, dependencies);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        else Behavon.useEffect(() => undefined, dependencies);
        const expand = Behavon.useCallback(() => {
          dependencies.push(1);
          setEpoch((value) => value + 1);
        }, [setEpoch]);
        Behavon.useSignal(modelPort1, "expand", expand);
        Behavon.useExport(modelPort1, "expand");
        return undefined;
      }

      const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort1Type>), undefined);
      const failure = await captureScheduledFailure(() => signalOf(root, "expand")());
      expectShapeFailure(failure, api, "array\\(length 1\\)", "array\\(length 2\\)");
      expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
    });
  }

  for (const initialMode of ["omitted", "array"] as const) {
    it(`rejects a useEffect ${initialMode} to ${initialMode === "omitted" ? "array" : "omitted"} change`, async () => {
      interface Endpoints {
        readonly changeMode: Signal;
      }

      type ModelPort2Type = { "changeMode": PortOnlySignal<any> };
      const modelPort2 = Behavon.createPort<ModelPort2Type>({ "changeMode": Behavon.SignalType() });
      function Model(): undefined {
        const [changed, setChanged] = Behavon.useState(false);
        const dependencies = initialMode === "omitted"
          ? (changed ? [] : undefined)
          : (changed ? undefined : []);
        // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only runtime probe transitions between omitted and explicit dependency modes
        Behavon.useEffect(() => undefined, dependencies);
        const changeMode = Behavon.useCallback(() => setChanged(true), [setChanged]);
        Behavon.useSignal(modelPort2, "changeMode", changeMode);
        Behavon.useExport(modelPort2, "changeMode");
        return undefined;
      }

      const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort2Type>), undefined);
      const failure = await captureScheduledFailure(() => signalOf(root, "changeMode")());
      expectShapeFailure(
        failure,
        "useEffect",
        initialMode === "omitted" ? "omitted" : "array\\(length 0\\)",
        initialMode === "omitted" ? "array\\(length 0\\)" : "omitted",
      );
      expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
    });
  }

  it("does not activate a failed dependency-shape candidate before terminal root cleanup", async () => {
    interface Endpoints {
      readonly fail: Signal;
      readonly inspect: Signal;
    }
    const effects: string[] = [];
    const observed: boolean[] = [];

    type ModelPort3Type = { "inspect": PortOnlySignal<any>; "fail": PortOnlySignal<any> };
    const modelPort3 = Behavon.createPort<ModelPort3Type>({ "inspect": Behavon.SignalType(), "fail": Behavon.SignalType() });
    function Model(): undefined {
      const [failedCandidate, setFailedCandidate] = Behavon.useState(false);
      const inspect = Behavon.useCallback(() => {
        observed.push(failedCandidate);
      }, [failedCandidate]);
      Behavon.useSignal(modelPort3, "inspect", inspect);
      Behavon.useEffect(() => {
        effects.push(`setup:${failedCandidate}`);
        return () => effects.push(`cleanup:${failedCandidate}`);
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only runtime probe intentionally changes dependency mode in a failing candidate
      }, failedCandidate ? undefined : []);
      const fail = Behavon.useCallback(() => setFailedCandidate(true), [setFailedCandidate]);
      Behavon.useSignal(modelPort3, "fail", fail);
      Behavon.useExport(modelPort3, "inspect");
      Behavon.useExport(modelPort3, "fail");
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort3Type>), undefined);
    expect(effects).toEqual(["setup:false"]);

    const failure = await captureScheduledFailure(() => signalOf(root, "fail")());
    expectShapeFailure(failure, "useEffect", "array\\(length 0\\)", "omitted", 3);
    expect(observed).toEqual([]);
    expect(effects).toEqual(["setup:false", "cleanup:false"]);
    expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
  });
});
