/* eslint-disable behavon-hooks/canonical-api, behavon-hooks/evaluation-purity -- test-only probes retain and intentionally discard Hook results */
import { describe, expect, it, vi } from "vitest";
import Behave from "behavon";
import type { ModelInstance, Signal, TypedModelRef } from "behavon";
import { waitFor } from "../helpers";
import {
  inspectModelInstanceForTests,
  observeModelInstanceCreationForTests,
} from "../../src/internal/model-inspection";

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

interface ExportedSurface {
  readonly identity: object;
  readonly set: Signal<readonly [next: number]>;
}

describe("Model public exports", () => {
  it("shares one immutable export identity through the direct ref and dependency view", () => {
    const initialize = vi.fn(() => ({ identity: Object.freeze({ token: 1 }) }));
    let dependencyIdentity: object | undefined;
    function Target(): number {
      const exported = Behave.useExport(initialize);
      const [value, setValue] = Behave.useState(1);
      const set = Behave.useCallback((next: number) => setValue(next), [setValue]);
      Behave.useSignal("set", set);
      expect(Object.isFrozen(exported)).toBe(true);
      return value;
    }
    const target = Behave.createModel(Target, undefined) as ModelInstance<undefined, number> &
      TypedModelRef<ExportedSurface>;
    function Consumer(): undefined {
      const dependency = Behave.usePort(target);
      dependencyIdentity = dependency.identity;
      return undefined;
    }
    const consumer = Behave.createModel(Consumer, undefined);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(dependencyIdentity).toBe(target.identity);
    expect(target.identity).toEqual({ token: 1 });
    target.set(2);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(target.identity).toBe(dependencyIdentity);
    consumer.dispose();
    target.dispose();
    expect(() => target.identity).toThrow(/disposed/);
  });

  it("keeps exports separate from the committed Model output observed by useModel", async () => {
    function Target(input: number): number {
      Behave.useExport(() => ({ identity: Object.freeze({ kind: "export" }) }));
      return input * 2;
    }
    const target = Behave.createModel(Target, 2) as ModelInstance<number, number> &
      TypedModelRef<{ readonly identity: object }>;
    let output = 0;
    let setInput: ((next: number) => void) | undefined;
    function Observer(): undefined {
      [output, setInput] = Behave.useModel(target);
      return undefined;
    }
    const observer = Behave.createModel(Observer, undefined);
    const identity = target.identity;
    expect(output).toBe(4);
    setInput?.(3);
    await waitFor(() => output === 6);
    expect(output).toBe(6);
    expect(target.identity).toBe(identity);
    observer.dispose();
    target.dispose();
  });

  it("does not publish a construction candidate and retains committed exports after failed reevaluation", async () => {
    let candidate: object | undefined;
    const stop = observeModelInstanceCreationForTests((ref) => { candidate = ref; });
    try {
      expect(() => Behave.createModel(function FailingConstruction(): undefined {
        const exported = Behave.useExport(() => ({ identity: Object.freeze({}) }));
        void exported.identity;
        throw new Error("construction failed");
      }, undefined)).toThrow("construction failed");
    } finally {
      stop();
    }
    expect(candidate).toBeDefined();
    expect(inspectModelInstanceForTests(candidate as object).exports.size).toBe(0);
    expect(() => (candidate as TypedModelRef<{ readonly identity: object }>).identity).toThrow(/disposed/);

    const initialize = vi.fn(() => ({ identity: Object.freeze({ stable: true }) }));
    function StableThenFail(): undefined {
      const exported = Behave.useExport(initialize);
      const [fail, setFail] = Behave.useState(false);
      const failNow = Behave.useCallback(() => setFail(true), [setFail]);
      Behave.useSignal("fail", failNow);
      void exported.identity;
      if (fail) throw new Error("reevaluation failed");
      return undefined;
    }
    const model = Behave.createModel(StableThenFail, undefined) as TypedModelRef<{
      readonly identity: object;
      readonly fail: Signal;
    }>; 
    const identity = model.identity;
    expect(await captureScheduledFailure(() => model.fail())).toEqual(new Error("reevaluation failed"));
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(() => model.identity).toThrow(/disposed/);
    expect(identity).toEqual({ stable: true });
  });

  it("rejects invalid export objects, reserved names, duplicates, and endpoint collisions", () => {
    const cases: Array<readonly [string, () => unknown]> = [
      ["null", () => null],
      ["primitive", () => 1],
      ["plain object", () => []],
      ["class instance", () => new (class ExportValue { readonly value = 1; })()],
      ["symbol", () => ({ [Symbol("x")]: 1 })],
      ["reserved", () => ({ dispose: 1 })],
      ["function", () => ({ command: () => undefined })],
      ["accessor", () => Object.defineProperty({}, "value", { enumerable: true, get: () => 1 })],
      ["non-enumerable", () => Object.defineProperty({}, "value", { value: 1 })],
    ];
    for (const [label, initialize] of cases) {
      function Invalid(): undefined {
        Behave.useExport(initialize as () => Readonly<Record<string, unknown>>);
        return undefined;
      }
      expect(() => Behave.createModel(Invalid, undefined), label).toThrow();
    }

    function Duplicate(): undefined {
      const first = Behave.useExport(() => ({ value: 1 }));
      const second = Behave.useExport(() => ({ value: 2 }));
      void first;
      void second;
      return undefined;
    }
    expect(() => Behave.createModel(Duplicate, undefined)).toThrow(/duplicate public export 'value'/);

    function EndpointFirst(): undefined {
      const body = Behave.useCallback(() => undefined, []);
      Behave.useSignal("value", body);
      const exported = Behave.useExport(() => ({ value: 1 }));
      void exported;
      return undefined;
    }
    function ExportFirst(): undefined {
      const exported = Behave.useExport(() => ({ value: 1 }));
      const body = Behave.useCallback(() => undefined, []);
      Behave.useSignal("value", body);
      void exported;
      return undefined;
    }
    expect(() => Behave.createModel(EndpointFirst, undefined)).toThrow(/both an endpoint and an export/);
    expect(() => Behave.createModel(ExportFirst, undefined)).toThrow(/both an endpoint and an export/);
  });

  it("runs the lazy initializer in a restricted user-function frame exactly once", () => {
    function NestedHook(): undefined {
      const exported = Behave.useExport(() => {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- test-only nested Hook runtime probe
        Behave.useState(0);
        return { value: 1 };
      });
      void exported.value;
      return undefined;
    }
    expect(() => Behave.createModel(NestedHook, undefined)).toThrow(
      /Behave\.useState cannot be called inside useExport initializer/,
    );
  });

  it("retains the first export through render-phase retries and keeps reflection endpoint-only", () => {
    const initialize = vi.fn(() => ({ first: Object.freeze({}), second: 2 }));
    function Retry(): number {
      const exported = Behave.useExport(initialize);
      const [value, setValue] = Behave.useState(0);
      if (value === 0) setValue(1);
      return exported.second + value;
    }
    const model = Behave.createModel(Retry, undefined) as ModelInstance<undefined, number> &
      TypedModelRef<{ readonly first: object; readonly second: number }>;
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(model.second).toBe(2);
    expect(Behave.getInterface(model)).toEqual({ endpoints: [] });
    model.dispose();
  });

  it("does not automatically proxy Boundary Child exports onto the outer ref", () => {
    function Child(): undefined {
      const exported = Behave.useExport(() => ({ childIdentity: Object.freeze({}) }));
      void exported.childIdentity;
      return undefined;
    }
    const Wrapped = Behave.boundary(Child);
    const outer = Behave.createModel(Wrapped, undefined);
    expect(() => outer.childIdentity).toThrow(/has no endpoint 'childIdentity'/);
    outer.dispose();
  });

  it("rejects direct and dependency export reads during cleanup and after disposal", () => {
    type Surface = { readonly identity: object };
    let target: TypedModelRef<Surface>;
    let dependency: { readonly identity: object } | undefined;
    const cleanupFailures: unknown[] = [];
    function Target(): undefined {
      Behave.useExport(() => ({ identity: Object.freeze({}) }));
      Behave.useEffect(() => () => {
        try {
          target.identity;
        } catch (error: unknown) {
          cleanupFailures.push(error);
        }
        try {
          dependency?.identity;
        } catch (error: unknown) {
          cleanupFailures.push(error);
        }
      }, []);
      return undefined;
    }
    const instance = Behave.createModel(Target, undefined);
    target = instance as TypedModelRef<Surface>;
    function Consumer(): undefined {
      dependency = Behave.usePort(target);
      return undefined;
    }
    const consumer = Behave.createModel(Consumer, undefined);
    instance.dispose();
    expect(cleanupFailures).toHaveLength(2);
    for (const failure of cleanupFailures) expect(String(failure)).toMatch(/disposed during .*export lookup 'identity'/);
    expect(() => target.identity).toThrow(/disposed/);
    expect(() => dependency?.identity).toThrow(/disposed/);
    consumer.dispose();
  });
});
