import Behavon, { createResource, useEffect, useExport, useReducer, useResource } from "behavon";
// @ts-expect-error The dependency Hook was hard-renamed; the old named export is absent.
import { use as removedUse } from "behavon";
import type {
  BehavonInterfaceDescriptor,
  Connection,
  ConnectionMeta,
  DependencyProxy,
  EndpointInterfaceDescriptor,
  Model,
  ModelHandle,
  ModelInstance,
  MutableHandle,
  PortDescriptor,
  SnapshotId,
  SnapshotRootId,
  StateId,
  TransactionId,
  BoundaryState,
  Signal,
  Slot,
  StateSetter,
  StateUpdate,
  Reducer,
  ReducerDispatch,
  ResourceAbortSignal,
  ResourceSnapshot,
  TypedModelRef,
} from "behavon";
// @ts-expect-error SnapshotIdentity is an implementation helper, not public API.
import type { SnapshotIdentity } from "behavon";
// @ts-expect-error SnapshotTypeMarker is an implementation helper, not public API.
import type { SnapshotTypeMarker } from "behavon";
// @ts-expect-error SignalTypeMarker is an implementation helper, not public API.
import type { SignalTypeMarker } from "behavon";
// @ts-expect-error SlotTypeMarker is an implementation helper, not public API.
import type { SlotTypeMarker } from "behavon";

void (undefined as unknown as SnapshotIdentity);
void (undefined as unknown as SnapshotTypeMarker);
void (undefined as unknown as SignalTypeMarker);
void (undefined as unknown as SlotTypeMarker);
void removedUse;

// @ts-expect-error The old default-facade member is absent without a compatibility alias.
Behavon.use;

export function useNamedEffectContract(): void {
  useEffect(() => undefined, []);
}

export function ReactCorrespondingHookTypeFailures(): void {
  const memo: number = Behavon.useMemo(() => 1, []);
  /* eslint-disable behavon-hooks/exhaustive-deps -- type-only invalid reproductions exercise declaration-level rejection */
  // @ts-expect-error useMemo requires an explicit dependency list.
  const missingMemoDependencies = Behavon.useMemo(() => 1);
  // @ts-expect-error useMemo dependencies must be a readonly array.
  const malformedMemoDependencies = Behavon.useMemo(() => 1, "not dependencies");
  // @ts-expect-error useMemo requires a callable factory.
  const malformedMemoFactory = Behavon.useMemo(1, []);
  /* eslint-enable behavon-hooks/exhaustive-deps */

  const external: number = Behavon.useSyncExternalStore(
    () => () => undefined,
    () => 1,
  );
  // @ts-expect-error useSyncExternalStore subscribe must return an unsubscribe function.
  const malformedSubscribe = Behavon.useSyncExternalStore(() => undefined, () => 1);
  // @ts-expect-error useSyncExternalStore requires a callable snapshot reader.
  const malformedSnapshotReader = Behavon.useSyncExternalStore(() => () => undefined, 1);

  // @ts-expect-error Effect setup cannot return a Promise cleanup.
  useEffect(() => Promise.resolve(), []);
  // @ts-expect-error Effect cleanup must be a function when setup returns a value.
  useEffect(() => 1, []);
  void [memo, missingMemoDependencies, malformedMemoDependencies, malformedMemoFactory];
  void [external, malformedSubscribe, malformedSnapshotReader];
}

export function RemovedExportInitializerContract(): undefined {
  // @ts-expect-error useExport takes a Port declared with createPort; the initializer form was removed.
  useExport(() => ({ value: 1 as const }));
  return undefined;
}

type PublicTypeContract = readonly [
  StateUpdate<number>,
  StateSetter<number>,
  Reducer<number, [number]>,
  ReducerDispatch<[number]>,
  Signal,
  Slot,
  TypedModelRef<DetailedDependencySurface>,
  UntypedModelRef,
  Connection,
  ConnectionMeta,
  EndpointInterfaceDescriptor,
  BehavonInterfaceDescriptor,
  Model,
  DependencyProxy,
  ModelInstance,
  ModelHandle,
  BoundaryState,
  MutableHandle<number>,
  PortDescriptor<{ changed: Signal<[value: number]> }>,
  SnapshotId<number>,
  SnapshotRootId<number>,
];

export function UseReducerTypeContract() {
  const [count, dispatch] = useReducer(
    (state: number, action: { readonly amount: number }) => state + action.amount,
    0,
  );
  const state: number = count;
  const result: void = dispatch({ amount: 1 });
  // @ts-expect-error One-action reducer dispatch requires its action.
  dispatch();
  // @ts-expect-error Reducer dispatch accepts no more than one action.
  dispatch({ amount: 1 }, { amount: 2 });
  // @ts-expect-error Reducer action type is preserved.
  dispatch({ amount: "wrong" });

  const [initialized, initializedDispatch] = Behavon.useReducer(
    (current: number, amount: number) => current + amount,
    "4",
    (initial: string) => Number(initial),
  );
  const initializedState: number = initialized;
  initializedDispatch(2);

  const [, tick] = Behavon.useReducer((current: number) => current + 1, 0);
  tick();
  // @ts-expect-error Zero-action reducer dispatch rejects an action.
  tick(1);
  return { state, result, initializedState };
}

const noActionResource = createResource({
  open: () => ({ value: 1 }),
  close: () => undefined,
  abort: () => undefined,
});
const typedActionResource = createResource({
  open: () => ({ value: 1 }),
  close: () => undefined,
  abort: () => undefined,
  actions: {
    sync: ({ resource }: { resource: { value: number }; signal: ResourceAbortSignal }) => resource.value,
    asyncLike: ({ resource }: { resource: { value: number }; signal: ResourceAbortSignal }): PromiseLike<number> =>
      Promise.resolve(resource.value),
  },
});
// Where AbortSignal is declared, the Resource signals are the standard one and go to fetch without a cast.
const fetchResource = createResource({
  open: ({ input, signal }: { input: string; signal: ResourceAbortSignal }) => fetch(input, { signal }),
  close: () => undefined,
  abort: () => undefined,
  actions: {
    fetchMore: ({ signal }: { resource: Response; signal: ResourceAbortSignal }, url: string) => fetch(url, { signal }),
  },
});
void fetchResource;

export function useResourceTypeContract(): void {
  const [snapshot, noActions] = useResource(noActionResource, undefined);
  const exactSnapshot: ResourceSnapshot<unknown> = snapshot;
  // @ts-expect-error A Resource without actions does not expose an arbitrary action index signature.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid action probe is never executed
  noActions.missing();
  const [, actions] = useResource(typedActionResource, undefined);
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only managed action signature probe is never executed
  const sync: number = actions.sync();
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only managed action signature probe is never executed
  const normalized: Promise<number> = actions.asyncLike();
  void [exactSnapshot, sync, normalized];
}

interface DeclaredPort {
  snapshotId: SnapshotRootId<number>;
  changed: Signal<[value: number]>;
  receive: Slot<[value: number]>;
}

const declaredPort = Behavon.createPort<DeclaredPort>({
  snapshotId: Behavon.SnapshotType(),
  changed: Behavon.SignalType(),
  receive: Behavon.SlotType(),
});

// @ts-expect-error createPort is interface-first and requires an explicit public Port type.
Behavon.createPort({ changed: Behavon.SignalType() });
// @ts-expect-error Every declared Port member is required by the runtime descriptor.
Behavon.createPort<DeclaredPort>({
  snapshotId: Behavon.SnapshotType(),
  changed: Behavon.SignalType(),
});
Behavon.createPort<DeclaredPort>({
  snapshotId: Behavon.SnapshotType(),
  changed: Behavon.SignalType(),
  receive: Behavon.SlotType(),
  // @ts-expect-error Runtime descriptors cannot add a member absent from the Port interface.
  extra: Behavon.SignalType(),
});
Behavon.createPort<DeclaredPort>({
  snapshotId: Behavon.SnapshotType(),
  // @ts-expect-error The descriptor role must match the Port interface member role.
  changed: Behavon.SlotType(),
  receive: Behavon.SlotType(),
});
Behavon.createPort<DeclaredPort>({
  snapshotId: Behavon.SnapshotType(),
  // @ts-expect-error The descriptor payload must match the Port interface member payload.
  changed: Behavon.SignalType<[value: string]>(),
  receive: Behavon.SlotType(),
});

interface OptionalPort {
  changed?: Signal;
}
// @ts-expect-error Provider Port members cannot be optional.
Behavon.createPort<OptionalPort>({ changed: Behavon.SignalType() });

interface IndexedPort {
  [name: string]: Signal;
}
// @ts-expect-error Provider Ports require a finite exact key set.
Behavon.createPort<IndexedPort>({ changed: Behavon.SignalType() });

declare const providerPortSymbol: unique symbol;
interface SymbolKeyPort {
  [providerPortSymbol]: Signal;
}
// @ts-expect-error Provider Ports expose only string-named public members.
Behavon.createPort<SymbolKeyPort>({ [providerPortSymbol]: Behavon.SignalType() });

interface NumberKeyPort {
  0: Signal;
}
// @ts-expect-error Provider Ports expose only string-named public members.
Behavon.createPort<NumberKeyPort>({ 0: Behavon.SignalType() });

interface EmptyNamePort {
  "": Signal;
}
// @ts-expect-error An empty name cannot be registered through the unified Port namespace.
Behavon.createPort<EmptyNamePort>({ "": Behavon.SignalType() });

interface ProtoNamePort {
  __proto__: Signal;
}
// @ts-expect-error __proto__ cannot be represented safely as an ordinary descriptor member.
Behavon.createPort<ProtoNamePort>({ __proto__: Behavon.SignalType() });

interface EmptyPort {}
// @ts-expect-error createPort requires a non-empty finite Port interface.
Behavon.createPort<EmptyPort>({});
// @ts-expect-error object does not declare a Port member that can associate a Model body.
Behavon.createPort<object>({});
// @ts-expect-error {} does not declare a Port member that can associate a Model body.
Behavon.createPort<{}>({});

interface CallablePort {
  (value: number): void;
  fire: Signal;
}
// @ts-expect-error A Port is a non-callable public member surface.
Behavon.createPort<CallablePort>({ fire: Behavon.SignalType() });

interface ConstructablePort {
  new (value: number): object;
  fire: Signal;
}
// @ts-expect-error A Port cannot promise a construct signature absent from a Model ref.
Behavon.createPort<ConstructablePort>({ fire: Behavon.SignalType() });

interface ArbitraryPort {
  value: number;
}
// @ts-expect-error Provider Ports contain only snapshot roots, Signals, and Slots.
Behavon.createPort<ArbitraryPort>({ value: 1 });

interface DualRolePort {
  endpoint: Signal & Slot;
}
// @ts-expect-error One provider Port member cannot declare both endpoint roles.
Behavon.createPort<DualRolePort>({ endpoint: Behavon.SignalType() });

type UnionPort = { changed: Signal } | { receive: Slot };
// @ts-expect-error Provider Port itself must be one finite non-union interface.
Behavon.createPort<UnionPort>({ changed: Behavon.SignalType() });

interface EndpointRoleUnionPort {
  endpoint: Signal | Slot;
}
// @ts-expect-error A provider member cannot be a Signal/Slot union.
Behavon.createPort<EndpointRoleUnionPort>({ endpoint: Behavon.SignalType() });

interface SignalPayloadUnionPort {
  changed: Signal<[value: number]> | Signal<[value: string]>;
}
// @ts-expect-error A provider member cannot select between multiple Signal payloads.
Behavon.createPort<SignalPayloadUnionPort>({ changed: Behavon.SignalType() });

interface SnapshotEndpointUnionPort {
  value: SnapshotRootId<number> | Signal<[value: number]>;
}
// @ts-expect-error A provider member cannot be a snapshot/endpoint union.
Behavon.createPort<SnapshotEndpointUnionPort>({ value: Behavon.SnapshotType() });

interface SignalSnapshotIntersectionPort {
  value: Signal<[value: number]> & SnapshotRootId<number>;
}
// @ts-expect-error One provider member cannot be both a Signal and snapshot identity.
Behavon.createPort<SignalSnapshotIntersectionPort>({ value: Behavon.SignalType() });

interface SlotSnapshotIntersectionPort {
  value: Slot<[value: number]> & SnapshotRootId<number>;
}
// @ts-expect-error One provider member cannot be both a Slot and snapshot identity.
Behavon.createPort<SlotSnapshotIntersectionPort>({ value: Behavon.SlotType() });

interface AugmentedSignalPort {
  changed: Signal<[value: number]> & { label: string };
}
// @ts-expect-error Runtime Signals do not provide arbitrary intersection members.
Behavon.createPort<AugmentedSignalPort>({ changed: Behavon.SignalType() });

interface AugmentedSlotPort {
  receive: Slot<[value: number]> & { label: string };
}
// @ts-expect-error Runtime Slots do not provide arbitrary intersection members.
Behavon.createPort<AugmentedSlotPort>({ receive: Behavon.SlotType() });

interface OverloadedSignalPort {
  changed: Signal<[value: number]> & Signal<[value: string]>;
}
// @ts-expect-error Runtime Signals expose one exact payload signature.
Behavon.createPort<OverloadedSignalPort>({ changed: Behavon.SignalType() });

interface IndexedSnapshotPort {
  app: SnapshotRootId<number> & Readonly<Record<string, SnapshotId<number>>>;
}
// @ts-expect-error Snapshot Port declarations require a finite nested identity tree.
Behavon.createPort<IndexedSnapshotPort>({ app: Behavon.SnapshotType() });

interface OptionalSnapshotPort {
  app: SnapshotRootId<number> & { child?: SnapshotId<number> };
}
// @ts-expect-error Snapshot Port declaration children cannot be optional.
Behavon.createPort<OptionalSnapshotPort>({ app: Behavon.SnapshotType() });

declare const customSnapshotChild: unique symbol;
interface SymbolSnapshotPort {
  app: SnapshotRootId<number> & { [customSnapshotChild]: SnapshotId<string> };
}
// @ts-expect-error Runtime snapshot identities cannot expose custom symbol children.
Behavon.createPort<SymbolSnapshotPort>({ app: Behavon.SnapshotType() });

interface ReservedMarkerSnapshotPort {
  app: SnapshotRootId<number> & { $: SnapshotId<string> };
}
Behavon.createPort<ReservedMarkerSnapshotPort>({
  // @ts-expect-error $ is the snapshot payload marker and cannot also promise a public child identity.
  app: { $: Behavon.SnapshotType() },
});

interface ProtoSnapshotPort {
  app: SnapshotRootId<number> & { __proto__: SnapshotId<string> };
}
Behavon.createPort<ProtoSnapshotPort>({
  // @ts-expect-error __proto__ is not a supported recursive snapshot public key.
  app: { $: Behavon.SnapshotType(), __proto__: Behavon.SnapshotType() },
});

interface CallableSnapshotRootPort {
  app: SnapshotRootId<number> & ((value: number) => string);
}
Behavon.createPort<CallableSnapshotRootPort>({
  // @ts-expect-error Runtime snapshot roots are not callable.
  app: Behavon.SnapshotType(),
});

interface ConstructableSnapshotRootPort {
  app: SnapshotRootId<number> & { new (value: number): object };
}
Behavon.createPort<ConstructableSnapshotRootPort>({
  // @ts-expect-error Runtime snapshot roots are not constructable.
  app: Behavon.SnapshotType(),
});

type CallableSnapshotBranch = {
  child: SnapshotId<number>;
} & ((value: number) => string);
interface CallableSnapshotBranchPort {
  app: SnapshotRootId<number> & { branch: CallableSnapshotBranch };
}
Behavon.createPort<CallableSnapshotBranchPort>({
  app: {
    $: Behavon.SnapshotType(),
    // @ts-expect-error Runtime nested snapshot objects are not callable.
    branch: { child: Behavon.SnapshotType() },
  },
});

type ConstructableSnapshotBranch = {
  child: SnapshotId<number>;
} & { new (value: number): object };
interface ConstructableSnapshotBranchPort {
  app: SnapshotRootId<number> & { branch: ConstructableSnapshotBranch };
}
Behavon.createPort<ConstructableSnapshotBranchPort>({
  app: {
    $: Behavon.SnapshotType(),
    // @ts-expect-error Runtime nested snapshot objects are not constructable.
    branch: { child: Behavon.SnapshotType() },
  },
});

interface NestedRootSnapshotPort {
  app: SnapshotRootId<number> & { child: SnapshotRootId<string> };
}
Behavon.createPort<NestedRootSnapshotPort>({
  app: {
    $: Behavon.SnapshotType(),
    // @ts-expect-error Recursive snapshot members are child identities, not independent roots.
    child: Behavon.SnapshotType(),
  },
});

interface NumberSnapshotPort {
  app: SnapshotRootId<number> & { 0: SnapshotId<string> };
}
// @ts-expect-error Runtime snapshot identities cannot expose numeric children.
Behavon.createPort<NumberSnapshotPort>({ app: Behavon.SnapshotType() });

const DeclaredPortModel: Model<number, string, DeclaredPort> = (input) => {
  const snapshotId = Behavon.useExport(declaredPort, "snapshotId");
  const changedBody = Behavon.useCallback((value: number) => value, []);
  Behavon.useSignal(declaredPort, "changed", changedBody);
  const exportedChanged: Signal<readonly [value: number]> = Behavon.useExport(declaredPort, "changed");
  const receiveBody = Behavon.useCallback((value: number) => value, []);
  Behavon.useSlot(declaredPort, "receive", receiveBody);
  void [snapshotId, exportedChanged];
  return String(input);
};

const declaredPortInstance = Behavon.createModel(DeclaredPortModel, 1);
const declaredSnapshot: SnapshotRootId<number> = declaredPortInstance.snapshotId;
const declaredSignal: Signal<readonly [value: number]> = declaredPortInstance.changed;
// @ts-expect-error A Slot cannot be invoked on a ref, so the ref does not expose it.
declaredPortInstance.receive;
// The Slot hidden on the ref still reaches usePort, ready to connect but not to call.
interface DeclaredPortConnectorPort {
  changed: Signal<[value: number]>;
}
const declaredPortConnectorPort = Behavon.createPort<DeclaredPortConnectorPort>({ changed: Behavon.SignalType() });
const DeclaredPortConnector: Model<TypedModelRef<DeclaredPort>, undefined, DeclaredPortConnectorPort> = (target) => {
  const changedBody = Behavon.useCallback((_value: number) => undefined, []);
  const changed = Behavon.useSignal(declaredPortConnectorPort, "changed", changedBody);
  Behavon.useExport(declaredPortConnectorPort, "changed");
  const port = Behavon.usePort(target);
  Behavon.useConnect(changed, port.receive);
  // @ts-expect-error A Slot taken through usePort is for useConnect and cannot be invoked.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid Slot call probe is never executed
  port.receive(1);
  return undefined;
};
const declaredSlot = DeclaredPortConnector;
const declaredPortModelInstance: ModelInstance<number, string, DeclaredPort> = declaredPortInstance;
void [declaredSnapshot, declaredSignal, declaredSlot, declaredPortModelInstance];
// @ts-expect-error ModelInstance exposes every Port member as readonly even when the interface omits readonly.
declaredPortInstance.changed = declaredSignal;

function InvalidDeclaredPortContracts(): undefined {
  const wrongPayload = Behavon.useCallback((value: string) => value, []);
  // @ts-expect-error Port Signal payload is checked at registration.
  Behavon.useSignal(declaredPort, "changed", wrongPayload);
  const wrongRole = Behavon.useCallback((value: number) => value, []);
  // @ts-expect-error Snapshot members cannot be registered as Signals.
  Behavon.useSignal(declaredPort, "snapshotId", wrongRole);
  // @ts-expect-error useExport opens snapshot and Signal members, not Slots.
  Behavon.useExport(declaredPort, "receive");
  return undefined;
}
void InvalidDeclaredPortContracts;

interface SnapshotRootValue {
  readonly version: number;
}

function SnapshotIdentityContract() {
  const snapshots = Behavon.createId({
    $: Behavon.SnapshotType<SnapshotRootValue>(),
    change: Behavon.SnapshotType<string>(),
    group: {
      $: Behavon.SnapshotType<{ readonly phase: number }>(),
      completed: Behavon.SnapshotType<boolean>(),
    },
  });
  const direct = Behavon.createId(Behavon.SnapshotType<number>());
  const exactRoot: SnapshotRootId<SnapshotRootValue> = snapshots;
  const exactChild: SnapshotId<string> = snapshots.change;
  const exactNestedNode: SnapshotId<{ readonly phase: number }> = snapshots.group;
  const exactNestedLeaf: SnapshotId<boolean> = snapshots.group.completed;
  const exactDirect: SnapshotRootId<number> = direct;
  const [current, publish] = Behavon.useSnapshot(snapshots);
  const exactCurrent: SnapshotRootValue | undefined = current;
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only public signature probe is never executed
  publish({ version: 1 });
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only public signature probe is never executed
  publish(previous => ({ version: (previous?.version ?? 0) + 1 }));
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only public signature probe is never executed
  publish(snapshots.change, "next");
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only public signature probe is never executed
  publish(snapshots.group, { phase: 1 });
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only public signature probe is never executed
  publish(snapshots.group.completed, previous => !(previous ?? false));
  // @ts-expect-error Snapshot publishers require exactly one root argument or two child arguments.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid arity probe is never executed
  publish();
  // @ts-expect-error Snapshot publishers reject three or more arguments.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid arity probe is never executed
  publish(snapshots.change, "next", "extra");
  const childCurrent: string | undefined = Behavon.getSnapshot(snapshots.change)();
  const [directCurrent, directPublish] = Behavon.useSnapshot(direct);
  const exactDirectCurrent: number | undefined = directCurrent;
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only root-only signature probe is never executed
  directPublish(1);
  const directRead: number | undefined = Behavon.getSnapshot(direct)();
  // @ts-expect-error A root-only family has no child publication target.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid signature probe is never executed
  directPublish(snapshots.change, "invalid");
  Behavon.subscribe(snapshots.group.completed)(() => undefined);
  // @ts-expect-error Child identities cannot own a snapshot family.
  Behavon.useSnapshot(snapshots.change);
  // @ts-expect-error Namespace-only nodes are not snapshot payload identities.
  Behavon.getSnapshot({ nested: snapshots.change });
  // @ts-expect-error createId roots must declare a payload.
  Behavon.createId({ change: Behavon.SnapshotType<string>() });
  // @ts-expect-error Descriptor children are recursively limited to SnapshotType markers or descriptor objects.
  Behavon.createId({ $: Behavon.SnapshotType<number>(), invalid: 1 });
  // @ts-expect-error Nested $ payload declarations must use SnapshotType markers.
  Behavon.createId({
    $: Behavon.SnapshotType<number>(),
    group: { $: "invalid", child: Behavon.SnapshotType<string>() },
  });
  const unrelated = Behavon.createId({
    $: Behavon.SnapshotType<number>(),
    change: Behavon.SnapshotType<Date>(),
  });
  // @ts-expect-error An unrelated child with an incompatible payload contract is not this family's child type.
  const invalidTarget: typeof snapshots.change = unrelated.change;
  void invalidTarget;
  // @ts-expect-error A child payload outside this family's child union cannot be targeted.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid signature probe is never executed
  publish(unrelated.change, undefined as unknown as Date);
  return {
    exactRoot,
    exactChild,
    exactNestedNode,
    exactNestedLeaf,
    exactDirect,
    exactCurrent,
    childCurrent,
    exactDirectCurrent,
    directRead,
  };
}
void SnapshotIdentityContract;

const transactionStateIds = Behavon.createId({
  count: Behavon.StateType<number>(),
  nested: { enabled: Behavon.StateType<boolean>() },
});
const transactionStateId: StateId<number> = transactionStateIds.count;
const previousContractValue = 1;

const transactionContractPort = Behavon.createPort<{ executeTransaction: Signal }>({
  executeTransaction: Behavon.SignalType(),
});

function TransactionTypeContract(): number {
  const [count, setCount] = Behavon.useLabelState(transactionStateId, 0);
  const execute = Behavon.useCallback(() => {
    const id: TransactionId = Behavon.createId();
    Behavon.transaction.start(id, [transactionStateIds.count]);
    const result: number = Behavon.transaction.run(id, () => {
      setCount((previous) => previous + 1);
      return previousContractValue;
    });
    void result;
    // @ts-expect-error transaction.run bodies must not return PromiseLike values.
    Behavon.transaction.run(id, async () => 1); // eslint-disable-line behavon-hooks/evaluation-purity -- type-only invalid synchronous-contract probe
    const thenableBody = (): PromiseLike<number> => Promise.resolve(1);
    // @ts-expect-error transaction.run rejects non-async PromiseLike-returning bodies too.
    Behavon.transaction.run(id, thenableBody);
    Behavon.transaction.commit(id);
  }, [setCount]);
  Behavon.useSignal(transactionContractPort, "executeTransaction", execute);
  Behavon.useExport(transactionContractPort, "executeTransaction");
  return count;
}
void TransactionTypeContract;

// @ts-expect-error StateId payload types are not interchangeable.
const invalidTransactionStateId: StateId<string> = transactionStateIds.count;
void invalidTransactionStateId;

function MutableContract(initial: { readonly value: number }) {
  const mutable: MutableHandle<{ readonly value: number }> = Behavon.useMutable(initial);
  const current: { readonly value: number } = mutable.get();
  mutable.set({ value: current.value + 1 });
  mutable.set(previous => ({ value: previous.value + 1 }));
  // @ts-expect-error useMutable deliberately has no React DOM-ref .current surface.
  mutable.current;
  // @ts-expect-error MutableHandle preserves the initial value type.
  mutable.set("wrong");
  const functionValue = () => 1;
  const functionMutable = Behavon.useMutable(functionValue);
  const exactFunction: () => number = functionMutable.get();
  return { mutable, exactFunction };
}
void MutableContract;

function BoundaryContract(): Model<number, BoundaryState<string>> {
  const safeString = Behavon.boundary<number, string>(String);
  const exactModel: Model<number, BoundaryState<string>> = safeString;
  declareBoundaryState(undefined as unknown as BoundaryState<string>);
  return exactModel;
}

function declareBoundaryState(state: BoundaryState<string>): void {
  if (state.status === "active") {
    const output: string = state.output;
    void output;
  } else {
    const error: unknown = state.error;
    const reset: () => void = state.reset;
    void error;
    void reset;
  }
}
void BoundaryContract;

declare const observedStringModel: ModelInstance<number, string>;

function PortlessModelContract(observed: ModelInstance<number, string>) {
  const [output, setInput]: ModelHandle<number, string> = Behavon.useModel(observed);
  // @ts-expect-error A Model without a Port exposes no endpoints on its ref.
  void observed.dynamicSignal;
  return { output, setInput };
}
void PortlessModelContract;

declare const publicTypeContract: PublicTypeContract;
void publicTypeContract;

function StateOverloadContract(): undefined {
  const omitted = Behavon.useState();
  const explicit = Behavon.useState<number>();
  const initialized = Behavon.useState(1);
  const lazy = Behavon.useState(() => "ready");
  const exactOmitted: readonly [undefined, StateSetter<undefined>] = omitted;
  const exactExplicit: readonly [number | undefined, StateSetter<number | undefined>] = explicit;
  const exactInitialized: readonly [number, StateSetter<number>] = initialized;
  const exactLazy: readonly [string, StateSetter<string>] = lazy;
  void exactOmitted;
  void exactExplicit;
  void exactInitialized;
  void exactLazy;
  return undefined;
}
void StateOverloadContract;

interface EndpointDeclarationsPort {
  changed: Signal<readonly [value: number]>;
  receive: Slot<readonly [value: number]>;
}
const endpointDeclarationsPort = Behavon.createPort<EndpointDeclarationsPort>({
  changed: Behavon.SignalType(),
  receive: Behavon.SlotType(),
});

function EndpointDeclarations(): () => void {
  const signalBody = Behavon.useCallback((_value: number) => "body result", []);
  const slotBody = Behavon.useCallback((_value: number) => 42, []);
  const signal: Signal<readonly [value: number]> = Behavon.useSignal(endpointDeclarationsPort, "changed", signalBody);
  Behavon.useExport(endpointDeclarationsPort, "changed");
  const slot: Slot<readonly [value: number]> = Behavon.useSlot(endpointDeclarationsPort, "receive", slotBody);
  // @ts-expect-error useSignal takes a Port declared with createPort; the string form was removed.
  Behavon.useSignal("removed", signalBody);
  // @ts-expect-error useSlot takes a Port declared with createPort; the string form was removed.
  Behavon.useSlot("removed", slotBody);
  const invokeEndpoints = Behavon.useCallback(() => {
    const signalResult: undefined = signal(1);
    const slotResult: undefined = slot(1);
    void signalResult;
    void slotResult;
  }, [signal, slot]);
  return invokeEndpoints;
}
void EndpointDeclarations;

interface CallbackReceiver {
  readonly base: number;
}

function CallbackReceiverContract(): undefined {
  const original = function (this: CallbackReceiver, increment: number, suffix?: string): string {
    return `${this.base + increment}${suffix ?? ""}`;
  };
  const managed = Behavon.useCallback(original, []);
  const exact: typeof original = managed;
  const result: string = managed.call({ base: 40 }, 2, "!");
  void exact;
  void result;
  // @ts-expect-error The returned callback preserves the original explicit this parameter.
  managed.call({ missing: true }, 2);
  // @ts-expect-error Existing positional argument inference is preserved.
  managed.call({ base: 40 }, "wrong");
  return undefined;
}
void CallbackReceiverContract;

class CallbackConstructed {
  constructor(readonly value: number) {}
}

interface ConstructOnlyCallback {
  new(value: number): { readonly value: number };
}

interface HybridCallback {
  (this: { readonly base: number }, increment: number): string;
  new(label: string): { readonly label: string };
  readonly kind: "hybrid";
}

declare const constructOnlyCallback: ConstructOnlyCallback;
declare const hybridCallback: HybridCallback;

function* callbackGenerator(seed: number): Generator<string, { value: number }, boolean> {
  const advance = yield String(seed);
  return { value: advance ? seed + 1 : seed - 1 };
}

async function* callbackAsyncGenerator(
  seed: number,
): AsyncGenerator<string, { value: number }, boolean> {
  const advance = yield String(seed);
  return { value: advance ? seed + 1 : seed - 1 };
}

type IsExact<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? (<Value>() => Value extends Right ? 1 : 2) extends
      (<Value>() => Value extends Left ? 1 : 2)
      ? true
      : false
    : false;
type AssertExact<Value extends true> = Value;

function CallbackFunctionShapeContract(): undefined {
  const managedClass = Behavon.useCallback(CallbackConstructed, []);
  const managedConstructOnly = Behavon.useCallback(constructOnlyCallback, []);
  const managedHybrid = Behavon.useCallback(hybridCallback, []);
  const managedGenerator = Behavon.useCallback(callbackGenerator, []);
  const managedAsyncGenerator = Behavon.useCallback(callbackAsyncGenerator, []);
  const exactClass: typeof CallbackConstructed = managedClass;
  const exactConstructOnly: ConstructOnlyCallback = managedConstructOnly;
  const exactHybrid: HybridCallback = managedHybrid;
  const exactGenerator: typeof callbackGenerator = managedGenerator;
  const exactAsyncGenerator: typeof callbackAsyncGenerator = managedAsyncGenerator;
  const classInstance: CallbackConstructed = new managedClass(1);
  const constructOnlyInstance: { readonly value: number } = new managedConstructOnly(2);
  const hybridCallResult: string = managedHybrid.call({ base: 40 }, 2);
  const hybridConstructResult: { readonly label: string } = new managedHybrid("managed");
  const generatorIterator = managedGenerator(1);
  const asyncGeneratorIterator = managedAsyncGenerator(2);
  const generatorResult: IteratorResult<string, { value: number }> = generatorIterator.next();
  const asyncGeneratorResult: Promise<IteratorResult<string, { value: number }>> =
    asyncGeneratorIterator.next(true);
  type GeneratorYield = ReturnType<typeof managedGenerator> extends
    Generator<infer Yield, unknown, unknown> ? Yield : never;
  type GeneratorReturn = ReturnType<typeof managedGenerator> extends
    Generator<unknown, infer Return, unknown> ? Return : never;
  type GeneratorNext = ReturnType<typeof managedGenerator> extends
    Generator<unknown, unknown, infer Next> ? Next : never;
  type AsyncGeneratorYield = ReturnType<typeof managedAsyncGenerator> extends
    AsyncGenerator<infer Yield, unknown, unknown> ? Yield : never;
  type AsyncGeneratorReturn = ReturnType<typeof managedAsyncGenerator> extends
    AsyncGenerator<unknown, infer Return, unknown> ? Return : never;
  type AsyncGeneratorNext = ReturnType<typeof managedAsyncGenerator> extends
    AsyncGenerator<unknown, unknown, infer Next> ? Next : never;
  const exactGeneratorYield: AssertExact<IsExact<GeneratorYield, string>> = true;
  const exactGeneratorReturn: AssertExact<IsExact<GeneratorReturn, { value: number }>> = true;
  const exactGeneratorNext: AssertExact<IsExact<GeneratorNext, boolean>> = true;
  const exactAsyncGeneratorYield: AssertExact<IsExact<AsyncGeneratorYield, string>> = true;
  const exactAsyncGeneratorReturn: AssertExact<
    IsExact<AsyncGeneratorReturn, { value: number }>
  > = true;
  const exactAsyncGeneratorNext: AssertExact<IsExact<AsyncGeneratorNext, boolean>> = true;
  // @ts-expect-error The managed generator preserves its exact next input type.
  generatorIterator.next("wrong");
  // @ts-expect-error The managed async generator preserves its exact next input type.
  asyncGeneratorIterator.next("wrong");
  void exactClass;
  void exactConstructOnly;
  void exactHybrid;
  void exactGenerator;
  void exactAsyncGenerator;
  void classInstance;
  void constructOnlyInstance;
  void hybridCallResult;
  void hybridConstructResult;
  void generatorResult;
  void asyncGeneratorResult;
  void exactGeneratorYield;
  void exactGeneratorReturn;
  void exactGeneratorNext;
  void exactAsyncGeneratorYield;
  void exactAsyncGeneratorReturn;
  void exactAsyncGeneratorNext;
  return undefined;
}
void CallbackFunctionShapeContract;

declare const symbolEndpoint: unique symbol;

interface DetailedDependencySurface {
  readonly changed: Signal<readonly [value: number]>;
  readonly receive: Slot<readonly [value: number]>;
  readonly relay: Signal<readonly [value: number]> & Slot<readonly [value: number]>;
  readonly voidCommand: (value: string) => void;
  readonly undefinedCommand: () => undefined;
  readonly returnsNumber: () => number;
  readonly count: number;
  readonly settings: { readonly enabled: boolean };
  readonly optional?: Signal<readonly [value: number]>;
  readonly uncertain: Signal<readonly [value: number]> | { readonly fallback: true };
  readonly dispose: Signal<readonly []>;
  readonly then: Signal<readonly []>;
  readonly toJSON: Signal<readonly []>;
  readonly constructor: Signal<readonly []>;
  readonly [symbolEndpoint]: Signal<readonly []>;
  readonly unchecked: any;
  readonly impossible: never;
}
declare const detailedDependency: DependencyProxy<DetailedDependencySurface>;
// A ref of a Model without a Port: only dispose.
declare const detailedRef: TypedModelRef<object>;
type ReservedDependencyKey = "dispose" | "then" | "toJSON" | "constructor";
type AssertNever<Value extends never> = Value;
type DetailedReservedKeys = AssertNever<Extract<ReservedDependencyKey, keyof typeof detailedDependency>>;
declare const detailedReservedKeys: DetailedReservedKeys;
void detailedReservedKeys;

interface DetailedDependencyContractInput {
  readonly dependency: DependencyProxy<DetailedDependencySurface>;
  readonly ref: TypedModelRef<DetailedDependencySurface>;
}

function DetailedDependencyContract(input: DetailedDependencyContractInput): undefined {
  const dependency = Behavon.usePort(input.ref);
  Behavon.useConnect(dependency.changed, input.dependency.receive);
  Behavon.useConnect(input.dependency.changed, input.dependency.receive);
  Behavon.useConnect(input.dependency.relay, input.dependency.receive);
  Behavon.useConnect(input.dependency.changed, input.dependency.relay);
  return undefined;
}
void DetailedDependencyContract;

const signalResult: undefined = detailedDependency.changed(1);
void signalResult;
// @ts-expect-error Detailed Signal endpoints preserve payload validation.
detailedDependency.changed("wrong payload");
// @ts-expect-error Dependency Proxy Slot properties are connection capabilities; direct Slot calls use the useSlot return handle.
detailedDependency.receive(1);
const relayResult: undefined = detailedDependency.relay(1);
void relayResult;
const exportedCount: number = detailedDependency.count;
const exportedSettings: { readonly enabled: boolean } = detailedDependency.settings;
void exportedCount;
void exportedSettings;
// @ts-expect-error Dependency export properties are readonly.
detailedDependency.count = 2;
// @ts-expect-error Optional endpoints are not guaranteed capabilities.
detailedDependency.optional;
// @ts-expect-error A union with a non-endpoint member is not a guaranteed endpoint capability.
detailedDependency.uncertain;
// @ts-expect-error Runtime-reserved names are never endpoint capabilities.
detailedDependency.dispose;
// @ts-expect-error Runtime-reserved names are never endpoint capabilities.
detailedDependency.then;
// @ts-expect-error Runtime-reserved names are never endpoint capabilities.
detailedDependency.toJSON;
// @ts-expect-error The inherited Object constructor is not a Behavon endpoint capability.
const constructorEndpoint: Signal = detailedDependency.constructor;
void constructorEndpoint;
// @ts-expect-error Runtime dependency Proxies do not expose symbol endpoints.
detailedDependency[symbolEndpoint];
// @ts-expect-error any does not prove a Signal or Slot endpoint capability.
detailedDependency.unchecked;
// @ts-expect-error never does not describe a realizable endpoint capability.
detailedDependency.impossible;

declare const detailedTypedRef: TypedModelRef<DetailedDependencySurface>;
declare const plainTypedShape: {
  readonly changed: Signal<readonly [value: number]>;
  readonly relay: Signal<readonly [value: number]> & Slot<readonly [value: number]>;
  readonly voidCommand: (value: string) => void;
  readonly undefinedCommand: () => undefined;
  dispose(): void;
};
declare const anyTypedRef: TypedModelRef<any>;
declare const indexedTypedRef: TypedModelRef<Readonly<Record<string, Signal>>>;

const typedSignalResult: undefined = detailedTypedRef.changed(1);
const typedRelayResult: undefined = detailedTypedRef.relay(1);
const typedVoidResult: void = detailedTypedRef.voidCommand("command");
const typedUndefinedResult: undefined = detailedTypedRef.undefinedCommand();
// @ts-expect-error A Slot cannot be invoked on a ref, so the ref does not expose it.
detailedTypedRef.receive(1);
const typedSlotResult: undefined = undefined;
const typedNumberResult: number = detailedTypedRef.returnsNumber();
const typedCount: number = detailedTypedRef.count;
const typedSettings: { readonly enabled: boolean } = detailedTypedRef.settings;
const typedOptional: Signal<readonly [value: number]> | undefined = detailedTypedRef.optional;
const typedUncertain: Signal<readonly [value: number]> | { readonly fallback: true } =
  detailedTypedRef.uncertain;
const typedDisposeResult: void = detailedTypedRef.dispose();
const typedThenResult: undefined = detailedTypedRef.then();
const typedToJSONResult: undefined = detailedTypedRef.toJSON();
const typedConstructorResult: undefined = detailedTypedRef.constructor();
const typedSymbolResult: undefined = detailedTypedRef[symbolEndpoint]();
const typedUnchecked: any = detailedTypedRef.unchecked;
const typedImpossible: never = detailedTypedRef.impossible;
const typedDescriptor: BehavonInterfaceDescriptor = Behavon.getInterface(detailedTypedRef);
const anyTypedDisposeResult: void = anyTypedRef.dispose();
const indexedTypedDisposeResult: void = indexedTypedRef.dispose();
void typedSignalResult;
void typedRelayResult;
void typedVoidResult;
void typedUndefinedResult;
void typedSlotResult;
void typedNumberResult;
void typedCount;
void typedSettings;
void typedOptional;
void typedUncertain;
void typedDisposeResult;
void typedThenResult;
void typedToJSONResult;
void typedConstructorResult;
void typedSymbolResult;
void typedUnchecked;
void typedImpossible;
void typedDescriptor;
void anyTypedDisposeResult;
void indexedTypedDisposeResult;

// @ts-expect-error Typed Model refs preserve Signal payload validation.
detailedTypedRef.changed("wrong payload");
// @ts-expect-error A closed typed Model ref rejects unknown commands.
detailedTypedRef.typo();
// @ts-expect-error The opaque typed-ref identity rejects structurally similar plain objects.
const rejectedPlainTypedRef: TypedModelRef<DetailedDependencySurface> = plainTypedShape;
void rejectedPlainTypedRef;
// @ts-expect-error A ref without the Port's members does not prove the consumer's Needs contract.
const rejectedUntypedNarrowing: TypedModelRef<DetailedDependencySurface> = detailedRef;
const anyTypedMember: any = anyTypedRef.arbitraryCommand;
const indexedTypedMember: Signal = indexedTypedRef.arbitraryCommand;
void rejectedUntypedNarrowing;
void anyTypedMember;
void indexedTypedMember;

function TypedModelRefContract() {
  const dependency: DependencyProxy<DetailedDependencySurface> = Behavon.usePort(detailedTypedRef);
  const changed: Signal<readonly [value: number]> = dependency.changed;
  const receive = dependency.receive;
  // @ts-expect-error usePort(typedRef) preserves Needs instead of reopening a dynamic endpoint surface.
  dependency.runtimeEndpoint;
  // @ts-expect-error A typed external command view does not prove Model input/output metadata.
  const invalidObservation = Behavon.useModel(detailedTypedRef);
  return { dependency, changed, receive, invalidObservation };
}
void TypedModelRefContract;

// @ts-expect-error A ref without a Port exposes no endpoints.
detailedRef.changed("runtime-validated payload");
const detailedRoot: TypedModelRef<object> =
  Behavon.createModel(String, 1);
const detailedInstance: ModelInstance<number, string> =
  Behavon.createModel(String, 1);
const assertedCreatedTypedRef = detailedInstance as TypedModelRef<DetailedDependencySurface>;
void assertedCreatedTypedRef;

function AssemblyTypedRefContract(ref: typeof assertedCreatedTypedRef): undefined {
  const dependency = Behavon.usePort(ref);
  Behavon.useEffect(() => {
    dependency.changed(1);
    // @ts-expect-error Assembly typed usePort preserves the Signal payload contract.
    dependency.changed("wrong payload");
    // @ts-expect-error Assembly typed usePort does not reopen unknown endpoint names.
    dependency.unknownEndpoint();
  }, [dependency]);
  return undefined;
}
void AssemblyTypedRefContract;

interface DetailedModelContractInput {
  readonly instance: ModelInstance<number, string>;
  readonly boundaryInstance: ModelInstance<number, BoundaryState<string>>;
}

function DetailedModelContract(input: DetailedModelContractInput) {
  const detailedObservation: ModelHandle<number, string> = Behavon.useModel(input.instance);
  const boundaryObservation: ModelHandle<number, BoundaryState<string>> =
    Behavon.useModel(input.boundaryInstance);
  return { detailedObservation, boundaryObservation };
}
void DetailedModelContract;
void detailedRoot;
void detailedInstance;

// Each removed name has its own assertion so one missing export cannot mask another.
// @ts-expect-error Detailed ModelRef schema facade was removed.
import type { ModelRef } from "behavon";
// @ts-expect-error UntypedModelRef was removed with the Port-less Model API.
import type { UntypedModelRef } from "behavon";
function RemovedTypedRelationshipOverloads() {
  // @ts-expect-error usePort no longer accepts an endpoint schema type argument.
  const removedTypedUse = Behavon.usePort<DetailedDependencySurface>(detailedRef);
  // @ts-expect-error getInterface no longer accepts an endpoint schema type argument.
  const removedTypedGetInterface = Behavon.getInterface<DetailedDependencySurface>(detailedRef);
  // @ts-expect-error A schema-less ModelInstance cannot be reclassified as a Port instance by useModel.
  const [removedOutput, removedSetter] = Behavon.useModel<number, string, DetailedDependencySurface>(observedStringModel);
  // @ts-expect-error usePort requires a live Model ref; null is not an inert dependency sentinel.
  const removedNullableUse = Behavon.usePort(null);
  return {
    removedTypedUse,
    removedNullableUse,
    interfaceEndpoints: removedTypedGetInterface.endpoints,
    removedOutput,
    removedSetter,
  };
}
void RemovedTypedRelationshipOverloads;
// @ts-expect-error ModelBoundaryHandle was removed with the Hook-based Boundary API.
import type { ModelBoundaryHandle } from "behavon";
// @ts-expect-error ModelBoundaryResult was replaced by BoundaryState.
import type { ModelBoundaryResult } from "behavon";
// @ts-expect-error DependencyList is an internal signature helper, not a package export.
import type { DependencyList } from "behavon";
// @ts-expect-error MountedInput is an internal signature helper, not a package export.
import type { MountedInput } from "behavon";
// @ts-expect-error Endpoint is an internal Signal implementation helper, not a package export.
import type { Endpoint } from "behavon";
// @ts-expect-error EndpointSchema was an alias for object and is no longer part of the package contract.
import type { EndpointSchema } from "behavon";
// @ts-expect-error ReservedEndpointName is a runtime validation implementation detail.
import type { ReservedEndpointName } from "behavon";
// @ts-expect-error InterfaceTarget is an internal capability brand.
import type { InterfaceTarget } from "behavon";
// @ts-expect-error UntypedEndpoint was a declaration workaround, not a product contract.
import type { UntypedEndpoint } from "behavon";
// @ts-expect-error UntypedDependencySurface is an internal inference helper.
import type { UntypedDependencySurface } from "behavon";
// @ts-expect-error PublicSignals is an internal mapped-type helper.
import type { PublicSignals } from "behavon";
// @ts-expect-error DependencyFacade is an internal mapped-type helper.
import type { DependencyFacade } from "behavon";
// @ts-expect-error BehavonPublicApi duplicated the module surface and has been removed.
import type { BehavonPublicApi } from "behavon";
// @ts-expect-error Snapshot channel inspection is an internal test seam, not a package export.
import { inspectSnapshotChannelForTests } from "behavon";
// @ts-expect-error createModelRoot was hard-renamed and is not a compatibility export.
Behavon.createModelRoot;
