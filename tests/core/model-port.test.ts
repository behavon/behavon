import { describe, expect, it } from "vitest";
import Behave from "behavon";
import type {
  Model,
  ModelInstance,
  PortDescriptor,
  Signal,
  Slot,
  SnapshotId,
  SnapshotRootId,
} from "behavon";

interface CounterPort {
  snapshotId: SnapshotRootId<number>;
  changed: Signal<[value: number]>;
  receive: Slot<[value: number]>;
}

const counterPort = Behave.createPort<CounterPort>({
  snapshotId: Behave.SnapshotType(),
  changed: Behave.SignalType(),
  receive: Behave.SlotType(),
});

interface NestedSnapshotPort {
  app: SnapshotRootId<{ version: number }> & {
    change: SnapshotId<number>;
    task: { completed: SnapshotId<boolean> };
  };
}

const nestedSnapshotPort = Behave.createPort<NestedSnapshotPort>({
  app: {
    $: Behave.SnapshotType(),
    change: Behave.SnapshotType(),
    task: { completed: Behave.SnapshotType() },
  },
});

describe("Model Port declarations", () => {
  it("infers one typed ModelInstance from validated snapshot, Signal, and Slot registrations", () => {
    const Counter: Model<undefined, number, CounterPort> = () => {
      const snapshotId = Behave.useExport(counterPort, "snapshotId");
      const [value, setValue] = Behave.useState(1);
      const changedBody = Behave.useCallback((next: number) => next, []);
      const changed = Behave.useSignal(counterPort, "changed", changedBody);
      const receiveBody = Behave.useCallback((next: number) => {
        setValue(next);
      }, [setValue]);
      Behave.useSlot(counterPort, "receive", receiveBody);
      Behave.useEffect(() => {
        changed(value);
      }, [changed, value]);
      Behave.useSnapshot(snapshotId);
      return value;
    };

    const instance: ModelInstance<undefined, number, CounterPort> = Behave.createModel(
      Counter,
      undefined,
    );
    const identity = instance.snapshotId;
    instance.changed(4);
    expect(Behave.getInterface(instance).endpoints).toEqual([
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
    const completePort = Behave.createPort<CompletePort>({
      snapshotId: Behave.SnapshotType(),
      fire: Behave.SignalType(),
    });
    function Missing(): undefined {
      Behave.useExport(completePort, "snapshotId");
      return undefined;
    }
    expect(() => Behave.createModel(Missing, undefined)).toThrow(
      /did not register declared Port member 'fire'/,
    );

    interface SnapshotOnlyPort {
      snapshotId: SnapshotRootId<number>;
    }
    const snapshotOnlyPort = Behave.createPort<SnapshotOnlyPort>({
      snapshotId: Behave.SnapshotType(),
    });
    function Extra(): undefined {
      Behave.useExport(snapshotOnlyPort, "snapshotId");
      const extra = Behave.useCallback(() => undefined, []);
      Behave.useSignal("extra", extra);
      return undefined;
    }
    expect(() => Behave.createModel(Extra, undefined)).toThrow(
      /registered undeclared Port endpoint 'extra'/,
    );

    interface SignalPort {
      fire: Signal;
    }
    const signalPort = Behave.createPort<SignalPort>({ fire: Behave.SignalType() });
    const signalAsSlot = signalPort as unknown as PortDescriptor<{
      fire: Slot;
    }>;
    function WrongRole(): undefined {
      const fire = Behave.useCallback(() => undefined, []);
      Behave.useSlot(signalAsSlot, "fire", fire);
      return undefined;
    }
    expect(() => Behave.createModel(WrongRole, undefined)).toThrow(
      /declared as signal, not slot/,
    );

    interface OtherPort {
      other: Signal;
    }
    const otherPort = Behave.createPort<OtherPort>({ other: Behave.SignalType() });
    function Mixed(): undefined {
      const fire = Behave.useCallback(() => undefined, []);
      const other = Behave.useCallback(() => undefined, []);
      Behave.useSignal(signalPort, "fire", fire);
      Behave.useSignal(otherPort, "other", other);
      return undefined;
    }
    expect(() => Behave.createModel(Mixed, undefined)).toThrow(/more than one Port/);
  });

  it("treats every runtime descriptor key as required even when a widened variable bypasses excess-property typing", () => {
    interface PublicPort {
      fire: Signal;
    }
    const widenedDeclaration = {
      fire: Behave.SignalType<[]>(),
      extra: Behave.SignalType<[]>(),
    };
    const runtimeExactPort = Behave.createPort<PublicPort>(widenedDeclaration);
    function MissingRuntimeExtra(): undefined {
      const fire = Behave.useCallback(() => undefined, []);
      Behave.useSignal(runtimeExactPort, "fire", fire);
      return undefined;
    }
    expect(() => Behave.createModel(MissingRuntimeExtra, undefined)).toThrow(
      /did not register declared Port member 'extra'/,
    );
  });

  it("preserves actual nested keys when invalid widened descriptor authoring bypasses excess-property typing", () => {
    interface PublicSnapshotPort {
      app: SnapshotRootId<number> & { child: SnapshotId<number> };
    }
    const widenedNested = {
      $: Behave.SnapshotType<number>(),
      child: Behave.SnapshotType<number>(),
      extra: Behave.SnapshotType<number>(),
    };
    const runtimeNestedPort = Behave.createPort<PublicSnapshotPort>({ app: widenedNested });
    const RuntimeNested: Model<undefined, undefined, PublicSnapshotPort> = () => {
      Behave.useExport(runtimeNestedPort, "app");
      return undefined;
    };
    const instance = Behave.createModel(RuntimeNested, undefined);
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
    const ownerPort = Behave.createPort<OwnerPort>({ snapshotId: Behave.SnapshotType() });
    const Owner: Model<undefined, undefined, OwnerPort> = () => {
      const snapshotId = Behave.useExport(ownerPort, "snapshotId");
      const snapshot = Behave.useSnapshot(snapshotId);
      void snapshot;
      return undefined;
    };
    const owner = Behave.createModel(Owner, undefined);

    interface FacadePort {
      snapshotId: SnapshotRootId<number>;
    }
    const facadePort = Behave.createPort<FacadePort>({ snapshotId: Behave.SnapshotType() });
    const Facade: Model<undefined, undefined, FacadePort> = () => {
      Behave.useExport(facadePort, "snapshotId", owner.snapshotId);
      return undefined;
    };
    const facade = Behave.createModel(Facade, undefined);
    expect(facade.snapshotId).toBe(owner.snapshotId);
    facade.dispose();
    expect(() => Behave.getSnapshot(owner.snapshotId)).not.toThrow();
    owner.dispose();
  });

  it("rejects re-exporting a recursive snapshot child as an independent root", () => {
    interface OwnerPort {
      app: SnapshotRootId<number> & { child: SnapshotId<string> };
    }
    const ownerPort = Behave.createPort<OwnerPort>({
      app: { $: Behave.SnapshotType(), child: Behave.SnapshotType() },
    });
    const Owner: Model<undefined, undefined, OwnerPort> = () => {
      Behave.useExport(ownerPort, "app");
      return undefined;
    };
    const owner = Behave.createModel(Owner, undefined);

    interface InvalidFacadePort {
      childRoot: SnapshotRootId<string>;
    }
    const invalidFacadePort = Behave.createPort<InvalidFacadePort>({
      childRoot: Behave.SnapshotType(),
    });
    const InvalidFacade: Model<undefined, undefined, InvalidFacadePort> = () => {
      Behave.useExport(
        invalidFacadePort,
        "childRoot",
        owner.app.child as SnapshotRootId<string>,
      );
      return undefined;
    };
    expect(() => Behave.createModel(InvalidFacade, undefined)).toThrow(
      /requires the root snapshot identity/,
    );
    owner.dispose();
  });

  it("contextually declares a recursive snapshot identity without repeated payload generics", () => {
    const Nested: Model<undefined, undefined, NestedSnapshotPort> = () => {
      const app = Behave.useExport(nestedSnapshotPort, "app");
      const rootSnapshot = Behave.useSnapshot(app);
      void rootSnapshot;
      return undefined;
    };
    const nested = Behave.createModel(Nested, undefined);
    expect(nested.app.change).not.toBe(nested.app.task.completed);
    nested.dispose();
  });

  it("rejects invalid Port declarations before Model evaluation", () => {
    expect(() => Behave.createPort<{ invalid: Signal }>({
      invalid: 1 as never,
    })).toThrow(/descriptor node/);
    expect(() => Behave.createPort<{ dispose: Signal }>({
      dispose: Behave.SignalType(),
    } as never)).toThrow(/reserved/);
    expect(() => Behave.createPort<{ "": Signal }>({
      "": Behave.SignalType(),
    } as never)).toThrow(/reserved/);

    const protoDeclaration = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(protoDeclaration, "__proto__", {
      value: Behave.SignalType(),
      enumerable: true,
    });
    expect(() => Behave.createPort<{ __proto__: Signal }>(protoDeclaration as never)).toThrow(
      /reserved/,
    );

    expect(() => Behave.createPort<{
      app: SnapshotRootId<number> & { __proto__: SnapshotId<string> };
    }>({
      app: { $: Behave.SnapshotType(), __proto__: Behave.SnapshotType() },
    } as never)).toThrow(/plain object/);

    function DynamicPort(): undefined {
      Behave.createPort<{ fire: Signal }>({ fire: Behave.SignalType() });
      return undefined;
    }
    expect(() => Behave.createModel(DynamicPort, undefined)).toThrow(
      /cannot declare a Port while evaluating/,
    );
  });
});

type SurfaceProbe = {
  readonly changed: Signal<readonly [value: number]>;
};
void (undefined as unknown as SurfaceProbe);
