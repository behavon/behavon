import Behave from "behavon";
import type { Signal, SnapshotId, SnapshotRootId } from "behavon";

interface Port {
  fire: Signal;
}

const declaration = {
  fire: Behave.SignalType<[]>(),
  extra: Behave.SignalType<[]>(),
};
const fire = Behave.SignalType<[]>();
const key = "fire" as const;

Behave.createPort<Port>({ ...declaration });
Behave.createPort<Port>({ [key]: Behave.SignalType() });
Behave.createPort<Port>({ fire });
// @ts-expect-error Method syntax does not satisfy the Signal marker type.
Behave.createPort<Port>({ fire() { return Behave.SignalType(); } });
Behave.createPort<Port>({ get fire() { return Behave.SignalType<[]>(); } });

const nestedDeclaration = { child: Behave.SnapshotType<number>() };
Behave.createPort<{ app: SnapshotRootId<number> & { child: SnapshotId<number> } }>({
  app: { $: Behave.SnapshotType(), ...nestedDeclaration },
});

const signalMarker = Behave.SignalType<[]>();
Behave.createPort<Port>({ fire: signalMarker });

const widenedNested = {
  $: Behave.SnapshotType<number>(),
  child: Behave.SnapshotType<number>(),
  extra: Behave.SnapshotType<number>(),
};
Behave.createPort<{ app: SnapshotRootId<number> & { child: SnapshotId<number> } }>({
  app: widenedNested,
});

// @ts-expect-error Empty Port names are intentionally invalid authoring.
Behave.createPort<{ "": Signal }>({ "": Behave.SignalType() });
Behave.createPort<{
  app: SnapshotRootId<number> & { child: SnapshotId<number> };
}>({
  app: {
    $: Behave.SnapshotType(),
    // @ts-expect-error Recursive __proto__ is intentionally invalid authoring.
    __proto__: Behave.SnapshotType(),
  },
});
