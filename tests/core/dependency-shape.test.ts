import { describe, expect, it } from "vitest";
import Behave from "behavon";
import type { Signal } from "behavon";

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

function expectShapeFailure(
  failure: unknown,
  api: "useMemo" | "useCallback" | "useEffect",
  expected: string,
  received: string,
  hookIndex = 1,
): void {
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toMatch(
    new RegExp(`^Behave\\.${api} dependency shape changed in Model#\\d+ at hook index ${hookIndex}: expected ${expected}, received ${received}$`),
  );
}

describe("hook dependency shape invariants", () => {
  for (const api of ["useMemo", "useCallback", "useEffect"] as const) {
    it(`rejects a ${api} dependency length change`, async () => {
      interface Endpoints {
        readonly expand: Signal;
      }

      function Model(): undefined {
        const [expanded, setExpanded] = Behave.useState(false);
        const dependencies = expanded ? [0, 1] : [0];
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        if (api === "useMemo") Behave.useMemo(() => 1, dependencies);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        else if (api === "useCallback") Behave.useCallback(() => undefined, dependencies);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        else Behave.useEffect(() => undefined, dependencies);
        const expand = Behave.useCallback(() => setExpanded(true), [setExpanded]);
        Behave.useSignal("expand", expand);
        return undefined;
      }

      const root = Behave.createModel(Model, undefined);
      const failure = await captureScheduledFailure(() => root.expand());
      expectShapeFailure(failure, api, "array\\(length 1\\)", "array\\(length 2\\)");
      expect(() => Behave.getInterface(root)).toThrow(/disposed/);
    });
  }

  for (const api of ["useMemo", "useCallback", "useEffect"] as const) {
    it(`rejects an in-place ${api} dependency length change`, async () => {
      interface Endpoints {
        readonly expand: Signal;
      }
      const dependencies: unknown[] = [0];

      function Model(): undefined {
        const [, setEpoch] = Behave.useState(0);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        if (api === "useMemo") Behave.useMemo(() => 1, dependencies);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/canonical-api, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        else if (api === "useCallback") Behave.useCallback(() => undefined, dependencies);
        // eslint-disable-next-line react-hooks/rules-of-hooks, behavon-hooks/exhaustive-deps -- generated runtime probe selects one Hook kind and only exercises its dependency shape
        else Behave.useEffect(() => undefined, dependencies);
        const expand = Behave.useCallback(() => {
          dependencies.push(1);
          setEpoch((value) => value + 1);
        }, [setEpoch]);
        Behave.useSignal("expand", expand);
        return undefined;
      }

      const root = Behave.createModel(Model, undefined);
      const failure = await captureScheduledFailure(() => root.expand());
      expectShapeFailure(failure, api, "array\\(length 1\\)", "array\\(length 2\\)");
      expect(() => Behave.getInterface(root)).toThrow(/disposed/);
    });
  }

  for (const initialMode of ["omitted", "array"] as const) {
    it(`rejects a useEffect ${initialMode} to ${initialMode === "omitted" ? "array" : "omitted"} change`, async () => {
      interface Endpoints {
        readonly changeMode: Signal;
      }

      function Model(): undefined {
        const [changed, setChanged] = Behave.useState(false);
        const dependencies = initialMode === "omitted"
          ? (changed ? [] : undefined)
          : (changed ? undefined : []);
        // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only runtime probe transitions between omitted and explicit dependency modes
        Behave.useEffect(() => undefined, dependencies);
        const changeMode = Behave.useCallback(() => setChanged(true), [setChanged]);
        Behave.useSignal("changeMode", changeMode);
        return undefined;
      }

      const root = Behave.createModel(Model, undefined);
      const failure = await captureScheduledFailure(() => root.changeMode());
      expectShapeFailure(
        failure,
        "useEffect",
        initialMode === "omitted" ? "omitted" : "array\\(length 0\\)",
        initialMode === "omitted" ? "array\\(length 0\\)" : "omitted",
      );
      expect(() => Behave.getInterface(root)).toThrow(/disposed/);
    });
  }

  it("does not activate a failed dependency-shape candidate before terminal root cleanup", async () => {
    interface Endpoints {
      readonly fail: Signal;
      readonly inspect: Signal;
    }
    const effects: string[] = [];
    const observed: boolean[] = [];

    function Model(): undefined {
      const [failedCandidate, setFailedCandidate] = Behave.useState(false);
      const inspect = Behave.useCallback(() => {
        observed.push(failedCandidate);
      }, [failedCandidate]);
      Behave.useSignal("inspect", inspect);
      Behave.useEffect(() => {
        effects.push(`setup:${failedCandidate}`);
        return () => effects.push(`cleanup:${failedCandidate}`);
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only runtime probe intentionally changes dependency mode in a failing candidate
      }, failedCandidate ? undefined : []);
      const fail = Behave.useCallback(() => setFailedCandidate(true), [setFailedCandidate]);
      Behave.useSignal("fail", fail);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    expect(effects).toEqual(["setup:false"]);

    const failure = await captureScheduledFailure(() => root.fail());
    expectShapeFailure(failure, "useEffect", "array\\(length 0\\)", "omitted", 3);
    expect(observed).toEqual([]);
    expect(effects).toEqual(["setup:false", "cleanup:false"]);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
  });
});
