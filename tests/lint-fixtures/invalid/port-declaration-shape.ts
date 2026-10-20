import Behavon from "behavon";
import type { Signal, SnapshotId, SnapshotRootId } from "behavon";

interface Port {
  fire: Signal;
}

const declaration = {
  fire: Behavon.SignalType<[]>(),
  extra: Behavon.SignalType<[]>(),
};
const fire = Behavon.SignalType<[]>();
const key = "fire" as const;

Behavon.createPort<Port>({ ...declaration });
Behavon.createPort<Port>({ [key]: Behavon.SignalType() });
Behavon.createPort<Port>({ fire });
// @ts-expect-error Method syntax does not satisfy the Signal marker type.
Behavon.createPort<Port>({ fire() { return Behavon.SignalType(); } });
Behavon.createPort<Port>({ get fire() { return Behavon.SignalType<[]>(); } });

const nestedDeclaration = { child: Behavon.SnapshotType<number>() };
Behavon.createPort<{ app: SnapshotRootId<number> & { child: SnapshotId<number> } }>({
  app: { $: Behavon.SnapshotType(), ...nestedDeclaration },
});

const signalMarker = Behavon.SignalType<[]>();
Behavon.createPort<Port>({ fire: signalMarker });

const widenedNested = {
  $: Behavon.SnapshotType<number>(),
  child: Behavon.SnapshotType<number>(),
  extra: Behavon.SnapshotType<number>(),
};
Behavon.createPort<{ app: SnapshotRootId<number> & { child: SnapshotId<number> } }>({
  app: widenedNested,
});

// @ts-expect-error Empty Port names are intentionally invalid authoring.
Behavon.createPort<{ "": Signal }>({ "": Behavon.SignalType() });
Behavon.createPort<{
  app: SnapshotRootId<number> & { child: SnapshotId<number> };
}>({
  app: {
    $: Behavon.SnapshotType(),
    // @ts-expect-error Recursive __proto__ is intentionally invalid authoring.
    __proto__: Behavon.SnapshotType(),
  },
});
