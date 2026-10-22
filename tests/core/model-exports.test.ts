/* eslint-disable behavon-hooks/canonical-api, behavon-hooks/evaluation-purity -- test-only probes retain and intentionally discard Hook results */
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { Model, ModelInstance, Signal, SnapshotRootId, TypedModelRef } from "behavon";
import { waitFor, signalOf } from "../helpers";
import {
  inspectModelInstanceForTests,
  observeModelInstanceCreationForTests,
} from "../../src/internal/model-inspection";

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

interface ExportedSurface {
  readonly identity: SnapshotRootId<number>;
  readonly set: Signal<readonly [next: number]>;
}

const exportedSurfacePort = Behavon.createPort<ExportedSurface>({
  identity: Behavon.SnapshotType(),
  set: Behavon.SignalType(),
});

interface IdentityPort {
  readonly identity: SnapshotRootId<number>;
}

const identityPort = Behavon.createPort<IdentityPort>({ identity: Behavon.SnapshotType() });

describe("Model public exports", () => {
  it("shares one export identity through the direct ref and dependency view", () => {
    let dependencyIdentity: SnapshotRootId<number> | undefined;
    const Target: Model<undefined, number, ExportedSurface> = () => {
      Behavon.useExport(exportedSurfacePort, "identity");
      const [value, setValue] = Behavon.useState(1);
      const set = Behavon.useCallback((next: number) => setValue(next), [setValue]);
      Behavon.useSignal(exportedSurfacePort, "set", set);
      Behavon.useExport(exportedSurfacePort, "set");
      return value;
    };
    const target = Behavon.createModel(Target, undefined);
    function Consumer(): undefined {
      const dependency = Behavon.usePort(target);
      dependencyIdentity = dependency.identity;
      return undefined;
    }
    const consumer = Behavon.createModel(Consumer, undefined);
    expect(dependencyIdentity).toBe(target.identity);
    signalOf(target, "set")(2);
    expect(target.identity).toBe(dependencyIdentity);
    consumer.dispose();
    target.dispose();
    expect(() => target.identity).toThrow(/disposed/);
  });

  it("keeps exports separate from the committed Model output observed by useModel", async () => {
    const Target: Model<number, number, IdentityPort> = (input) => {
      Behavon.useExport(identityPort, "identity");
      return input * 2;
    };
    const target = Behavon.createModel(Target, 2);
    let output = 0;
    let setInput: ((next: number) => void) | undefined;
    function Observer(): undefined {
      [output, setInput] = Behavon.useModel(target);
      return undefined;
    }
    const observer = Behavon.createModel(Observer, undefined);
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
      const FailingConstruction: Model<undefined, undefined, IdentityPort> = () => {
        const exported = Behavon.useExport(identityPort, "identity");
        void exported;
        throw new Error("construction failed");
      };
      expect(() => Behavon.createModel(FailingConstruction, undefined)).toThrow("construction failed");
    } finally {
      stop();
    }
    expect(candidate).toBeDefined();
    expect(inspectModelInstanceForTests(candidate as object).exports.size).toBe(0);
    expect(() => (candidate as TypedModelRef<IdentityPort>).identity).toThrow(/disposed/);

    interface StableThenFailPort {
      readonly identity: SnapshotRootId<number>;
      readonly fail: Signal;
    }
    const stableThenFailPort = Behavon.createPort<StableThenFailPort>({
      identity: Behavon.SnapshotType(),
      fail: Behavon.SignalType(),
    });
    const StableThenFail: Model<undefined, undefined, StableThenFailPort> = () => {
      Behavon.useExport(stableThenFailPort, "identity");
      const [fail, setFail] = Behavon.useState(false);
      const failNow = Behavon.useCallback(() => setFail(true), [setFail]);
      Behavon.useSignal(stableThenFailPort, "fail", failNow);
      Behavon.useExport(stableThenFailPort, "fail");
      if (fail) throw new Error("reevaluation failed");
      return undefined;
    };
    const model = Behavon.createModel(StableThenFail, undefined);
    const identity = model.identity;
    expect(await captureScheduledFailure(() => signalOf(model, "fail")())).toEqual(new Error("reevaluation failed"));
    expect(() => model.identity).toThrow(/disposed/);
    expect(identity).toBeDefined();
  });

  it("rejects a non-Port argument, an undeclared name, and a duplicate export", () => {
    function NonPort(): undefined {
      // @ts-expect-error useExport only takes a Port declared with createPort.
      Behavon.useExport(() => ({ value: 1 }));
      return undefined;
    }
    expect(() => Behavon.createModel(NonPort, undefined)).toThrow(
      "Behavon.useExport requires a Port created by Behavon.createPort as its first argument",
    );

    function Undeclared(): undefined {
      // @ts-expect-error The name must be declared in the Port.
      Behavon.useExport(identityPort, "missing");
      return undefined;
    }
    expect(() => Behavon.createModel(Undeclared, undefined)).toThrow("Behavon Port has no declared member 'missing'");

    function Duplicate(): undefined {
      const first = Behavon.useExport(identityPort, "identity");
      const second = Behavon.useExport(identityPort, "identity");
      void first;
      void second;
      return undefined;
    }
    expect(() => Behavon.createModel(Duplicate, undefined)).toThrow(/duplicate public export 'identity'/);
  });

  it("retains the first export through render-phase retries and keeps reflection endpoint-only", () => {
    let seen: SnapshotRootId<number> | undefined;
    const Retry: Model<undefined, number, IdentityPort> = () => {
      const exported = Behavon.useExport(identityPort, "identity");
      const [value, setValue] = Behavon.useState(0);
      if (seen === undefined) seen = exported;
      else expect(exported).toBe(seen);
      if (value === 0) setValue(1);
      return value;
    };
    const model = Behavon.createModel(Retry, undefined) as ModelInstance<undefined, number, IdentityPort>;
    expect(model.identity).toBe(seen);
    expect(Behavon.getInterface(model)).toEqual({ endpoints: [] });
    model.dispose();
  });

  it("rejects direct and dependency export reads during cleanup and after disposal", () => {
    let target: TypedModelRef<IdentityPort>;
    let dependency: { readonly identity: SnapshotRootId<number> } | undefined;
    const cleanupFailures: unknown[] = [];
    const Target: Model<undefined, undefined, IdentityPort> = () => {
      Behavon.useExport(identityPort, "identity");
      Behavon.useEffect(() => () => {
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
    };
    const instance = Behavon.createModel(Target, undefined);
    target = instance;
    function Consumer(): undefined {
      dependency = Behavon.usePort(target);
      return undefined;
    }
    const consumer = Behavon.createModel(Consumer, undefined);
    instance.dispose();
    expect(cleanupFailures).toHaveLength(2);
    for (const failure of cleanupFailures) expect(String(failure)).toMatch(/disposed during .*export lookup 'identity'/);
    expect(() => target.identity).toThrow(/disposed/);
    expect(() => dependency?.identity).toThrow(/disposed/);
    consumer.dispose();
  });
});
