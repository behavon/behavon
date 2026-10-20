import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type {
  Model,
  ModelInstance,
  PortDescriptor,
  Signal,
  Slot,
  SnapshotId,
  SnapshotRootId,
  TypedModelRef,
} from "behavon";

interface CounterPort {
  snapshotId: SnapshotRootId<number>;
  changed: Signal<[value: number]>;
  receive: Slot<[value: number]>;
}

const counterPort = Behavon.createPort<CounterPort>({
  snapshotId: Behavon.SnapshotType(),
  changed: Behavon.SignalType(),
  receive: Behavon.SlotType(),
});

interface NestedSnapshotPort {
  app: SnapshotRootId<{ version: number }> & {
    change: SnapshotId<number>;
    task: { completed: SnapshotId<boolean> };
  };
}

const nestedSnapshotPort = Behavon.createPort<NestedSnapshotPort>({
  app: {
    $: Behavon.SnapshotType(),
    change: Behavon.SnapshotType(),
    task: { completed: Behavon.SnapshotType() },
  },
});

describe("Model Port declarations", () => {
  it("infers one typed ModelInstance from validated snapshot, Signal, and Slot registrations", () => {
    const Counter: Model<undefined, number, CounterPort> = () => {
      const snapshotId = Behavon.useExport(counterPort, "snapshotId");
      const [value, setValue] = Behavon.useState(1);
      const changedBody = Behavon.useCallback((next: number) => next, []);
      const changed = Behavon.useSignal(counterPort, "changed", changedBody);
      Behavon.useExport(counterPort, "changed");
      const receiveBody = Behavon.useCallback((next: number) => {
        setValue(next);
      }, [setValue]);
      Behavon.useSlot(counterPort, "receive", receiveBody);
      Behavon.useEffect(() => {
        changed(value);
      }, [changed, value]);
      Behavon.useSnapshot(snapshotId);
      return value;
    };

    const instance: ModelInstance<undefined, number, CounterPort> = Behavon.createModel(
      Counter,
      undefined,
    );
    const identity = instance.snapshotId;
    instance.changed(4);
    expect(Behavon.getInterface(instance).endpoints).toEqual([
      { name: "changed", signalRegistrations: 1, slotRegistrations: 0 },
      { name: "receive", signalRegistrations: 0, slotRegistrations: 1 },
    ]);
    expect(instance.snapshotId).toBe(identity);
    instance.dispose();
  });

  it("rejects incomplete, undeclared, wrong-role, and mixed-Port registrations", () => {
    interface CompletePort {
      snapshotId: SnapshotRootId<number>;
      fire: Signal;
    }
    const completePort = Behavon.createPort<CompletePort>({
      snapshotId: Behavon.SnapshotType(),
      fire: Behavon.SignalType(),
    });
    function Missing(): undefined {
      Behavon.useExport(completePort, "snapshotId");
      return undefined;
    }
    expect(() => Behavon.createModel(Missing, undefined)).toThrow(
      /did not register declared Port member 'fire'/,
    );

    interface SnapshotOnlyPort {
      snapshotId: SnapshotRootId<number>;
    }
    const snapshotOnlyPort = Behavon.createPort<SnapshotOnlyPort>({
      snapshotId: Behavon.SnapshotType(),
    });
    function InternalSignal(): undefined {
      Behavon.useExport(snapshotOnlyPort, "snapshotId");
      const extra = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal("extra", extra);
      return undefined;
    }
    const internal = Behavon.createModel(InternalSignal, undefined);
    expect(() => internal.extra).toThrow(/Signal 'extra' is not exported/);
    internal.dispose();

    function ExtraSlot(): undefined {
      Behavon.useExport(snapshotOnlyPort, "snapshotId");
      const extra = Behavon.useCallback(() => undefined, []);
      Behavon.useSlot("extra", extra);
      return undefined;
    }
    expect(() => Behavon.createModel(ExtraSlot, undefined)).toThrow(
      /registered undeclared Port endpoint 'extra'/,
    );

    function UnexportedSignal(): undefined {
      Behavon.useExport(completePort, "snapshotId");
      const fire = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal(completePort, "fire", fire);
      return undefined;
    }
    expect(() => Behavon.createModel(UnexportedSignal, undefined)).toThrow(
      /did not export declared Port Signal 'fire'/,
    );

    interface SignalPort {
      fire: Signal;
    }
    const signalPort = Behavon.createPort<SignalPort>({ fire: Behavon.SignalType() });
    const signalAsSlot = signalPort as unknown as PortDescriptor<{
      fire: Slot;
    }>;
    function WrongRole(): undefined {
      const fire = Behavon.useCallback(() => undefined, []);
      Behavon.useSlot(signalAsSlot, "fire", fire);
      return undefined;
    }
    expect(() => Behavon.createModel(WrongRole, undefined)).toThrow(
      /declared as signal, not slot/,
    );

    interface OtherPort {
      other: Signal;
    }
    const otherPort = Behavon.createPort<OtherPort>({ other: Behavon.SignalType() });
    function Mixed(): undefined {
      const fire = Behavon.useCallback(() => undefined, []);
      const other = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal(signalPort, "fire", fire);
      Behavon.useSignal(otherPort, "other", other);
      return undefined;
    }
    expect(() => Behavon.createModel(Mixed, undefined)).toThrow(/more than one Port/);
  });

  it("lets only Signals opened by useExport be called from outside the Model", async () => {
    interface MirrorPort {
      receive: Slot<[value: number]>;
    }
    const mirrorPort = Behavon.createPort<MirrorPort>({ receive: Behavon.SlotType() });
    const received: number[] = [];
    const Mirror: Model<undefined, undefined, MirrorPort> = () => {
      const receive = Behavon.useCallback((value: number) => {
        received.push(value);
      }, []);
      Behavon.useSlot(mirrorPort, "receive", receive);
      return undefined;
    };

    interface CountPort {
      increment: Signal;
    }
    const countPort = Behavon.createPort<CountPort>({ increment: Behavon.SignalType() });
    const Count: Model<TypedModelRef<MirrorPort>, number, CountPort> = (mirrorRef) => {
      const [value, setValue] = Behavon.useState(0);
      const increment = Behavon.useCallback(() => setValue((n) => n + 1), [setValue]);
      Behavon.useSignal(countPort, "increment", increment);
      Behavon.useExport(countPort, "increment");
      const changedBody = Behavon.useCallback((_value: number) => undefined, []);
      const valueChanged = Behavon.useSignal("valueChanged", changedBody);
      const mirror = Behavon.usePort(mirrorRef);
      Behavon.useConnect(valueChanged, mirror.receive);
      Behavon.useEffect(() => {
        valueChanged(value);
      }, [value, valueChanged]);
      return value;
    };

    const mirror = Behavon.createModel(Mirror, undefined);
    const count = Behavon.createModel(Count, mirror);
    count.increment();
    await Promise.resolve();
    expect(received).toEqual([0, 1]);

    const outside = count as unknown as Record<string, unknown>;
    expect(() => outside.valueChanged).toThrow(/Signal 'valueChanged' is not exported/);
    function Spy(target: TypedModelRef<CountPort>): undefined {
      const dependency = Behavon.usePort(target);
      const untyped = dependency as unknown as Record<string, unknown>;
      void untyped.valueChanged;
      return undefined;
    }
    expect(() => Behavon.createModel(Spy, count)).toThrow(/Signal 'valueChanged' is not exported/);
    expect(received).toEqual([0, 1]);
    count.dispose();
    mirror.dispose();
  });

  it("requires useSignal before useExport opens a Port Signal", () => {
    interface FirePort {
      fire: Signal;
    }
    const firePort = Behavon.createPort<FirePort>({ fire: Behavon.SignalType() });
    function ExportFirst(): undefined {
      Behavon.useExport(firePort, "fire");
      const fire = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal(firePort, "fire", fire);
      return undefined;
    }
    expect(() => Behavon.createModel(ExportFirst, undefined)).toThrow(
      /requires Signal 'fire' to be registered with useSignal first/,
    );
  });

  it("keeps a same-name Slot connectable but blocks invoking its unexported Signal part", () => {
    const delivered: number[] = [];
    function Dual(): undefined {
      const signalBody = Behavon.useCallback((_value: number) => undefined, []);
      const slotBody = Behavon.useCallback((value: number) => {
        delivered.push(value);
      }, []);
      Behavon.useSignal("shared", signalBody);
      Behavon.useSlot("shared", slotBody);
      return undefined;
    }
    const dual = Behavon.createModel(Dual, undefined);
    let invoke: (() => void) | undefined;
    function Wiring(): undefined {
      const body = Behavon.useCallback((_value: number) => undefined, []);
      const out = Behavon.useSignal("out", body);
      const dependency = Behavon.usePort(dual);
      Behavon.useConnect(out, dependency.shared);
      Behavon.useEffect(() => {
        out(7);
      }, [out]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a dependency handle
      invoke = () => dependency.shared(1);
      return undefined;
    }
    const wiring = Behavon.createModel(Wiring, undefined);
    expect(delivered).toEqual([7]);
    expect(() => invoke?.()).toThrow(/Signal 'shared' is not exported/);
    expect(delivered).toEqual([7]);
    wiring.dispose();
    dual.dispose();
  });

  it("treats every runtime descriptor key as required even when a widened variable bypasses excess-property typing", () => {
    interface PublicPort {
      fire: Signal;
    }
    const widenedDeclaration = {
      fire: Behavon.SignalType<[]>(),
      extra: Behavon.SignalType<[]>(),
    };
    const runtimeExactPort = Behavon.createPort<PublicPort>(widenedDeclaration);
    function MissingRuntimeExtra(): undefined {
      const fire = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal(runtimeExactPort, "fire", fire);
      Behavon.useExport(runtimeExactPort, "fire");
      return undefined;
    }
    expect(() => Behavon.createModel(MissingRuntimeExtra, undefined)).toThrow(
      /did not register declared Port member 'extra'/,
    );
  });

  it("preserves actual nested keys when invalid widened descriptor authoring bypasses excess-property typing", () => {
    interface PublicSnapshotPort {
      app: SnapshotRootId<number> & { child: SnapshotId<number> };
    }
    const widenedNested = {
      $: Behavon.SnapshotType<number>(),
      child: Behavon.SnapshotType<number>(),
      extra: Behavon.SnapshotType<number>(),
    };
    const runtimeNestedPort = Behavon.createPort<PublicSnapshotPort>({ app: widenedNested });
    const RuntimeNested: Model<undefined, undefined, PublicSnapshotPort> = () => {
      Behavon.useExport(runtimeNestedPort, "app");
      return undefined;
    };
    const instance = Behavon.createModel(RuntimeNested, undefined);
    const actual = instance.app as unknown as SnapshotRootId<number> & {
      readonly extra: SnapshotId<number>;
    };
    expect(actual.extra).toBeDefined();
    instance.dispose();
  });

  it("can re-export an existing root snapshot identity without taking ownership", () => {
    interface OwnerPort {
      snapshotId: SnapshotRootId<number>;
    }
    const ownerPort = Behavon.createPort<OwnerPort>({ snapshotId: Behavon.SnapshotType() });
    const Owner: Model<undefined, undefined, OwnerPort> = () => {
      const snapshotId = Behavon.useExport(ownerPort, "snapshotId");
      const snapshot = Behavon.useSnapshot(snapshotId);
      void snapshot;
      return undefined;
    };
    const owner = Behavon.createModel(Owner, undefined);

    interface FacadePort {
      snapshotId: SnapshotRootId<number>;
    }
    const facadePort = Behavon.createPort<FacadePort>({ snapshotId: Behavon.SnapshotType() });
    const Facade: Model<undefined, undefined, FacadePort> = () => {
      Behavon.useExport(facadePort, "snapshotId", owner.snapshotId);
      return undefined;
    };
    const facade = Behavon.createModel(Facade, undefined);
    expect(facade.snapshotId).toBe(owner.snapshotId);
    facade.dispose();
    expect(() => Behavon.getSnapshot(owner.snapshotId)).not.toThrow();
    owner.dispose();
  });

  it("rejects re-exporting a recursive snapshot child as an independent root", () => {
    interface OwnerPort {
      app: SnapshotRootId<number> & { child: SnapshotId<string> };
    }
    const ownerPort = Behavon.createPort<OwnerPort>({
      app: { $: Behavon.SnapshotType(), child: Behavon.SnapshotType() },
    });
    const Owner: Model<undefined, undefined, OwnerPort> = () => {
      Behavon.useExport(ownerPort, "app");
      return undefined;
    };
    const owner = Behavon.createModel(Owner, undefined);

    interface InvalidFacadePort {
      childRoot: SnapshotRootId<string>;
    }
    const invalidFacadePort = Behavon.createPort<InvalidFacadePort>({
      childRoot: Behavon.SnapshotType(),
    });
    const InvalidFacade: Model<undefined, undefined, InvalidFacadePort> = () => {
      Behavon.useExport(
        invalidFacadePort,
        "childRoot",
        owner.app.child as SnapshotRootId<string>,
      );
      return undefined;
    };
    expect(() => Behavon.createModel(InvalidFacade, undefined)).toThrow(
      /requires the root snapshot identity/,
    );
    owner.dispose();
  });

  it("contextually declares a recursive snapshot identity without repeated payload generics", () => {
    const Nested: Model<undefined, undefined, NestedSnapshotPort> = () => {
      const app = Behavon.useExport(nestedSnapshotPort, "app");
      const rootSnapshot = Behavon.useSnapshot(app);
      void rootSnapshot;
      return undefined;
    };
    const nested = Behavon.createModel(Nested, undefined);
    expect(nested.app.change).not.toBe(nested.app.task.completed);
    nested.dispose();
  });

  it("rejects invalid Port declarations before Model evaluation", () => {
    expect(() => Behavon.createPort<{ invalid: Signal }>({
      invalid: 1 as never,
    })).toThrow(/descriptor node/);
    expect(() => Behavon.createPort<{ dispose: Signal }>({
      dispose: Behavon.SignalType(),
    } as never)).toThrow(/reserved/);
    expect(() => Behavon.createPort<{ "": Signal }>({
      "": Behavon.SignalType(),
    } as never)).toThrow(/reserved/);

    const protoDeclaration = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(protoDeclaration, "__proto__", {
      value: Behavon.SignalType(),
      enumerable: true,
    });
    expect(() => Behavon.createPort<{ __proto__: Signal }>(protoDeclaration as never)).toThrow(
      /reserved/,
    );

    expect(() => Behavon.createPort<{
      app: SnapshotRootId<number> & { __proto__: SnapshotId<string> };
    }>({
      app: { $: Behavon.SnapshotType(), __proto__: Behavon.SnapshotType() },
    } as never)).toThrow(/plain object/);

    function DynamicPort(): undefined {
      Behavon.createPort<{ fire: Signal }>({ fire: Behavon.SignalType() });
      return undefined;
    }
    expect(() => Behavon.createModel(DynamicPort, undefined)).toThrow(
      /cannot declare a Port while evaluating/,
    );
  });
});

type SurfaceProbe = {
  readonly changed: Signal<readonly [value: number]>;
};
void (undefined as unknown as SurfaceProbe);
