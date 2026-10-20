import Behave, { createResource, useEffect, useExport, useReducer, useResource } from "behavon";
// @ts-expect-error The dependency Hook was hard-renamed; the old named export is absent.
import { use as removedUse } from "behavon";
import type {
  BehaveInterfaceDescriptor,
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
  UntypedModelRef,
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
Behave.use;

export function useNamedEffectContract(): void {
  useEffect(() => undefined, []);
}

export function ReactCorrespondingHookTypeFailures(): void {
  const memo: number = Behave.useMemo(() => 1, []);
  /* eslint-disable behavon-hooks/exhaustive-deps -- type-only invalid reproductions exercise declaration-level rejection */
  // @ts-expect-error useMemo requires an explicit dependency list.
  const missingMemoDependencies = Behave.useMemo(() => 1);
  // @ts-expect-error useMemo dependencies must be a readonly array.
  const malformedMemoDependencies = Behave.useMemo(() => 1, "not dependencies");
  // @ts-expect-error useMemo requires a callable factory.
  const malformedMemoFactory = Behave.useMemo(1, []);
  /* eslint-enable behavon-hooks/exhaustive-deps */

  const external: number = Behave.useSyncExternalStore(
    () => () => undefined,
    () => 1,
  );
  // @ts-expect-error useSyncExternalStore subscribe must return an unsubscribe function.
  const malformedSubscribe = Behave.useSyncExternalStore(() => undefined, () => 1);
  // @ts-expect-error useSyncExternalStore requires a callable snapshot reader.
  const malformedSnapshotReader = Behave.useSyncExternalStore(() => () => undefined, 1);

  // @ts-expect-error Effect setup cannot return a Promise cleanup.
  useEffect(() => Promise.resolve(), []);
  // @ts-expect-error Effect cleanup must be a function when setup returns a value.
  useEffect(() => 1, []);
  void [memo, missingMemoDependencies, malformedMemoDependencies, malformedMemoFactory];
  void [external, malformedSubscribe, malformedSnapshotReader];
}

export function useNamedExportContract(): number {
  const exported = useExport(() => ({ value: 1 as const }));
  return exported.value;
}

export function RejectFunctionExportContract(): undefined {
  // @ts-expect-error Public exports are non-function data capabilities.
  Behave.useExport(() => ({ command: () => undefined }));
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
  BehaveInterfaceDescriptor,
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

  const [initialized, initializedDispatch] = Behave.useReducer(
    (current: number, amount: number) => current + amount,
    "4",
    (initial: string) => Number(initial),
  );
  const initializedState: number = initialized;
  initializedDispatch(2);

  const [, tick] = Behave.useReducer((current: number) => current + 1, 0);
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

const declaredPort = Behave.createPort<DeclaredPort>({
  snapshotId: Behave.SnapshotType(),
  changed: Behave.SignalType(),
  receive: Behave.SlotType(),
});

// @ts-expect-error createPort is interface-first and requires an explicit public Port type.
Behave.createPort({ changed: Behave.SignalType() });
// @ts-expect-error Every declared Port member is required by the runtime descriptor.
Behave.createPort<DeclaredPort>({
  snapshotId: Behave.SnapshotType(),
  changed: Behave.SignalType(),
});
Behave.createPort<DeclaredPort>({
  snapshotId: Behave.SnapshotType(),
  changed: Behave.SignalType(),
  receive: Behave.SlotType(),
  // @ts-expect-error Runtime descriptors cannot add a member absent from the Port interface.
  extra: Behave.SignalType(),
});
Behave.createPort<DeclaredPort>({
  snapshotId: Behave.SnapshotType(),
  // @ts-expect-error The descriptor role must match the Port interface member role.
  changed: Behave.SlotType(),
  receive: Behave.SlotType(),
});
Behave.createPort<DeclaredPort>({
  snapshotId: Behave.SnapshotType(),
  // @ts-expect-error The descriptor payload must match the Port interface member payload.
  changed: Behave.SignalType<[value: string]>(),
  receive: Behave.SlotType(),
});

interface OptionalPort {
  changed?: Signal;
}
// @ts-expect-error Provider Port members cannot be optional.
Behave.createPort<OptionalPort>({ changed: Behave.SignalType() });

interface IndexedPort {
  [name: string]: Signal;
}
// @ts-expect-error Provider Ports require a finite exact key set.
Behave.createPort<IndexedPort>({ changed: Behave.SignalType() });

declare const providerPortSymbol: unique symbol;
interface SymbolKeyPort {
  [providerPortSymbol]: Signal;
}
// @ts-expect-error Provider Ports expose only string-named public members.
Behave.createPort<SymbolKeyPort>({ [providerPortSymbol]: Behave.SignalType() });

interface NumberKeyPort {
  0: Signal;
}
// @ts-expect-error Provider Ports expose only string-named public members.
Behave.createPort<NumberKeyPort>({ 0: Behave.SignalType() });

interface EmptyNamePort {
  "": Signal;
}
// @ts-expect-error An empty name cannot be registered through the unified Port namespace.
Behave.createPort<EmptyNamePort>({ "": Behave.SignalType() });

interface ProtoNamePort {
  __proto__: Signal;
}
// @ts-expect-error __proto__ cannot be represented safely as an ordinary descriptor member.
Behave.createPort<ProtoNamePort>({ __proto__: Behave.SignalType() });

interface EmptyPort {}
// @ts-expect-error createPort requires a non-empty finite Port interface.
Behave.createPort<EmptyPort>({});
// @ts-expect-error object does not declare a Port member that can associate a Model body.
Behave.createPort<object>({});
// @ts-expect-error {} does not declare a Port member that can associate a Model body.
Behave.createPort<{}>({});

interface CallablePort {
  (value: number): void;
  fire: Signal;
}
// @ts-expect-error A Port is a non-callable public member surface.
Behave.createPort<CallablePort>({ fire: Behave.SignalType() });

interface ConstructablePort {
  new (value: number): object;
  fire: Signal;
}
// @ts-expect-error A Port cannot promise a construct signature absent from a Model ref.
Behave.createPort<ConstructablePort>({ fire: Behave.SignalType() });

interface ArbitraryPort {
  value: number;
}
// @ts-expect-error Provider Ports contain only snapshot roots, Signals, and Slots.
Behave.createPort<ArbitraryPort>({ value: 1 });

interface DualRolePort {
  endpoint: Signal & Slot;
}
// @ts-expect-error One provider Port member cannot declare both endpoint roles.
Behave.createPort<DualRolePort>({ endpoint: Behave.SignalType() });

type UnionPort = { changed: Signal } | { receive: Slot };
// @ts-expect-error Provider Port itself must be one finite non-union interface.
Behave.createPort<UnionPort>({ changed: Behave.SignalType() });

interface EndpointRoleUnionPort {
  endpoint: Signal | Slot;
}
// @ts-expect-error A provider member cannot be a Signal/Slot union.
Behave.createPort<EndpointRoleUnionPort>({ endpoint: Behave.SignalType() });

interface SignalPayloadUnionPort {
  changed: Signal<[value: number]> | Signal<[value: string]>;
}
// @ts-expect-error A provider member cannot select between multiple Signal payloads.
Behave.createPort<SignalPayloadUnionPort>({ changed: Behave.SignalType() });

interface SnapshotEndpointUnionPort {
  value: SnapshotRootId<number> | Signal<[value: number]>;
}
// @ts-expect-error A provider member cannot be a snapshot/endpoint union.
Behave.createPort<SnapshotEndpointUnionPort>({ value: Behave.SnapshotType() });

interface SignalSnapshotIntersectionPort {
  value: Signal<[value: number]> & SnapshotRootId<number>;
}
// @ts-expect-error One provider member cannot be both a Signal and snapshot identity.
Behave.createPort<SignalSnapshotIntersectionPort>({ value: Behave.SignalType() });

interface SlotSnapshotIntersectionPort {
  value: Slot<[value: number]> & SnapshotRootId<number>;
}
// @ts-expect-error One provider member cannot be both a Slot and snapshot identity.
Behave.createPort<SlotSnapshotIntersectionPort>({ value: Behave.SlotType() });

interface AugmentedSignalPort {
  changed: Signal<[value: number]> & { label: string };
}
// @ts-expect-error Runtime Signals do not provide arbitrary intersection members.
Behave.createPort<AugmentedSignalPort>({ changed: Behave.SignalType() });

interface AugmentedSlotPort {
  receive: Slot<[value: number]> & { label: string };
}
// @ts-expect-error Runtime Slots do not provide arbitrary intersection members.
Behave.createPort<AugmentedSlotPort>({ receive: Behave.SlotType() });

interface OverloadedSignalPort {
  changed: Signal<[value: number]> & Signal<[value: string]>;
}
// @ts-expect-error Runtime Signals expose one exact payload signature.
Behave.createPort<OverloadedSignalPort>({ changed: Behave.SignalType() });

interface IndexedSnapshotPort {
  app: SnapshotRootId<number> & Readonly<Record<string, SnapshotId<number>>>;
}
// @ts-expect-error Snapshot Port declarations require a finite nested identity tree.
Behave.createPort<IndexedSnapshotPort>({ app: Behave.SnapshotType() });

interface OptionalSnapshotPort {
  app: SnapshotRootId<number> & { child?: SnapshotId<number> };
}
// @ts-expect-error Snapshot Port declaration children cannot be optional.
Behave.createPort<OptionalSnapshotPort>({ app: Behave.SnapshotType() });

declare const customSnapshotChild: unique symbol;
interface SymbolSnapshotPort {
  app: SnapshotRootId<number> & { [customSnapshotChild]: SnapshotId<string> };
}
// @ts-expect-error Runtime snapshot identities cannot expose custom symbol children.
Behave.createPort<SymbolSnapshotPort>({ app: Behave.SnapshotType() });

interface ReservedMarkerSnapshotPort {
  app: SnapshotRootId<number> & { $: SnapshotId<string> };
}
Behave.createPort<ReservedMarkerSnapshotPort>({
  // @ts-expect-error $ is the snapshot payload marker and cannot also promise a public child identity.
  app: { $: Behave.SnapshotType() },
});

interface ProtoSnapshotPort {
  app: SnapshotRootId<number> & { __proto__: SnapshotId<string> };
}
Behave.createPort<ProtoSnapshotPort>({
  // @ts-expect-error __proto__ is not a supported recursive snapshot public key.
  app: { $: Behave.SnapshotType(), __proto__: Behave.SnapshotType() },
});

interface CallableSnapshotRootPort {
  app: SnapshotRootId<number> & ((value: number) => string);
}
Behave.createPort<CallableSnapshotRootPort>({
  // @ts-expect-error Runtime snapshot roots are not callable.
  app: Behave.SnapshotType(),
});

interface ConstructableSnapshotRootPort {
  app: SnapshotRootId<number> & { new (value: number): object };
}
Behave.createPort<ConstructableSnapshotRootPort>({
  // @ts-expect-error Runtime snapshot roots are not constructable.
  app: Behave.SnapshotType(),
});

type CallableSnapshotBranch = {
  child: SnapshotId<number>;
} & ((value: number) => string);
interface CallableSnapshotBranchPort {
  app: SnapshotRootId<number> & { branch: CallableSnapshotBranch };
}
Behave.createPort<CallableSnapshotBranchPort>({
  app: {
    $: Behave.SnapshotType(),
    // @ts-expect-error Runtime nested snapshot objects are not callable.
    branch: { child: Behave.SnapshotType() },
  },
});

type ConstructableSnapshotBranch = {
  child: SnapshotId<number>;
} & { new (value: number): object };
interface ConstructableSnapshotBranchPort {
  app: SnapshotRootId<number> & { branch: ConstructableSnapshotBranch };
}
Behave.createPort<ConstructableSnapshotBranchPort>({
  app: {
    $: Behave.SnapshotType(),
    // @ts-expect-error Runtime nested snapshot objects are not constructable.
    branch: { child: Behave.SnapshotType() },
  },
});

interface NestedRootSnapshotPort {
  app: SnapshotRootId<number> & { child: SnapshotRootId<string> };
}
Behave.createPort<NestedRootSnapshotPort>({
  app: {
    $: Behave.SnapshotType(),
    // @ts-expect-error Recursive snapshot members are child identities, not independent roots.
    child: Behave.SnapshotType(),
  },
});

interface NumberSnapshotPort {
  app: SnapshotRootId<number> & { 0: SnapshotId<string> };
}
// @ts-expect-error Runtime snapshot identities cannot expose numeric children.
Behave.createPort<NumberSnapshotPort>({ app: Behave.SnapshotType() });

const DeclaredPortModel: Model<number, string, DeclaredPort> = (input) => {
  const snapshotId = Behave.useExport(declaredPort, "snapshotId");
  const changedBody = Behave.useCallback((value: number) => value, []);
  Behave.useSignal(declaredPort, "changed", changedBody);
  const receiveBody = Behave.useCallback((value: number) => value, []);
  Behave.useSlot(declaredPort, "receive", receiveBody);
  void snapshotId;
  return String(input);
};

const declaredPortInstance = Behave.createModel(DeclaredPortModel, 1);
const declaredSnapshot: SnapshotRootId<number> = declaredPortInstance.snapshotId;
const declaredSignal: Signal<readonly [value: number]> = declaredPortInstance.changed;
const declaredSlot: Slot<readonly [value: number]> = declaredPortInstance.receive;
const declaredPortModelInstance: ModelInstance<number, string, DeclaredPort> = declaredPortInstance;
void [declaredSnapshot, declaredSignal, declaredSlot, declaredPortModelInstance];
// @ts-expect-error ModelInstance exposes every Port member as readonly even when the interface omits readonly.
declaredPortInstance.changed = declaredSignal;

function InvalidDeclaredPortContracts(): undefined {
  const wrongPayload = Behave.useCallback((value: string) => value, []);
  // @ts-expect-error Port Signal payload is checked at registration.
  Behave.useSignal(declaredPort, "changed", wrongPayload);
  const wrongRole = Behave.useCallback((value: number) => value, []);
  // @ts-expect-error Snapshot members cannot be registered as Signals.
  Behave.useSignal(declaredPort, "snapshotId", wrongRole);
  return undefined;
}
void InvalidDeclaredPortContracts;

interface SnapshotRootValue {
  readonly version: number;
}

function SnapshotIdentityContract() {
  const snapshots = Behave.createId({
    $: Behave.SnapshotType<SnapshotRootValue>(),
    change: Behave.SnapshotType<string>(),
    group: {
      $: Behave.SnapshotType<{ readonly phase: number }>(),
      completed: Behave.SnapshotType<boolean>(),
    },
  });
  const direct = Behave.createId(Behave.SnapshotType<number>());
  const exactRoot: SnapshotRootId<SnapshotRootValue> = snapshots;
  const exactChild: SnapshotId<string> = snapshots.change;
  const exactNestedNode: SnapshotId<{ readonly phase: number }> = snapshots.group;
  const exactNestedLeaf: SnapshotId<boolean> = snapshots.group.completed;
  const exactDirect: SnapshotRootId<number> = direct;
  const [current, publish] = Behave.useSnapshot(snapshots);
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
  const childCurrent: string | undefined = Behave.getSnapshot(snapshots.change)();
  const [directCurrent, directPublish] = Behave.useSnapshot(direct);
  const exactDirectCurrent: number | undefined = directCurrent;
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only root-only signature probe is never executed
  directPublish(1);
  const directRead: number | undefined = Behave.getSnapshot(direct)();
  // @ts-expect-error A root-only family has no child publication target.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid signature probe is never executed
  directPublish(snapshots.change, "invalid");
  Behave.subscribe(snapshots.group.completed)(() => undefined);
  // @ts-expect-error Child identities cannot own a snapshot family.
  Behave.useSnapshot(snapshots.change);
  // @ts-expect-error Namespace-only nodes are not snapshot payload identities.
  Behave.getSnapshot({ nested: snapshots.change });
  // @ts-expect-error createId roots must declare a payload.
  Behave.createId({ change: Behave.SnapshotType<string>() });
  // @ts-expect-error Descriptor children are recursively limited to SnapshotType markers or descriptor objects.
  Behave.createId({ $: Behave.SnapshotType<number>(), invalid: 1 });
  // @ts-expect-error Nested $ payload declarations must use SnapshotType markers.
  Behave.createId({
    $: Behave.SnapshotType<number>(),
    group: { $: "invalid", child: Behave.SnapshotType<string>() },
  });
  const unrelated = Behave.createId({
    $: Behave.SnapshotType<number>(),
    change: Behave.SnapshotType<Date>(),
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

const transactionStateIds = Behave.createId({
  count: Behave.StateType<number>(),
  nested: { enabled: Behave.StateType<boolean>() },
});
const transactionStateId: StateId<number> = transactionStateIds.count;
const previousContractValue = 1;

function TransactionTypeContract(): number {
  const [count, setCount] = Behave.useLabelState(transactionStateId, 0);
  const execute = Behave.useCallback(() => {
    const id: TransactionId = Behave.createId();
    Behave.transaction.start(id, [transactionStateIds.count]);
    const result: number = Behave.transaction.run(id, () => {
      setCount((previous) => previous + 1);
      return previousContractValue;
    });
    void result;
    // @ts-expect-error transaction.run bodies must not return PromiseLike values.
    Behave.transaction.run(id, async () => 1); // eslint-disable-line behavon-hooks/evaluation-purity -- type-only invalid synchronous-contract probe
    const thenableBody = (): PromiseLike<number> => Promise.resolve(1);
    // @ts-expect-error transaction.run rejects non-async PromiseLike-returning bodies too.
    Behave.transaction.run(id, thenableBody);
    Behave.transaction.commit(id);
  }, [setCount]);
  Behave.useSignal("executeTransaction", execute);
  return count;
}
void TransactionTypeContract;

// @ts-expect-error StateId payload types are not interchangeable.
const invalidTransactionStateId: StateId<string> = transactionStateIds.count;
void invalidTransactionStateId;

function MutableContract(initial: { readonly value: number }) {
  const mutable: MutableHandle<{ readonly value: number }> = Behave.useMutable(initial);
  const current: { readonly value: number } = mutable.get();
  mutable.set({ value: current.value + 1 });
  mutable.set(previous => ({ value: previous.value + 1 }));
  // @ts-expect-error useMutable deliberately has no React DOM-ref .current surface.
  mutable.current;
  // @ts-expect-error MutableHandle preserves the initial value type.
  mutable.set("wrong");
  const functionValue = () => 1;
  const functionMutable = Behave.useMutable(functionValue);
  const exactFunction: () => number = functionMutable.get();
  return { mutable, exactFunction };
}
void MutableContract;

function BoundaryContract(): Model<number, BoundaryState<string>> {
  const safeString = Behave.boundary<number, string>(String);
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

interface SchemaLessRelationshipsInput {
  readonly root: UntypedModelRef;
  readonly observed: ModelInstance<number, string>;
}

function createSchemaLessRelationshipsInput(
  input: number,
  observed: ModelInstance<number, string>,
): SchemaLessRelationshipsInput {
  return {
    root: Behave.createModel(String, input),
    observed,
  };
}
void createSchemaLessRelationshipsInput;

function SchemaLessRelationships(input: SchemaLessRelationshipsInput) {
  const dependency: DependencyProxy = Behave.usePort(input.root);
  const [output, setInput]: ModelHandle<number, string> = Behave.useModel(input.observed);
  const rootSignal = input.root.dynamicSignal;
  const dependencyEndpoint = dependency.dynamicEndpoint;
  return {
    rootSignal,
    dependencyEndpoint,
    output,
    setInput,
  };
}
void SchemaLessRelationships;

declare const publicTypeContract: PublicTypeContract;
void publicTypeContract;

function StateOverloadContract(): undefined {
  const omitted = Behave.useState();
  const explicit = Behave.useState<number>();
  const initialized = Behave.useState(1);
  const lazy = Behave.useState(() => "ready");
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

function EndpointDeclarations(): () => void {
  const signalBody = Behave.useCallback((_value: number) => "body result", []);
  const slotBody = Behave.useCallback((_value: number) => 42, []);
  const signal: Signal<readonly [value: number]> = Behave.useSignal("changed", signalBody);
  const slot: Slot<readonly [value: number]> = Behave.useSlot("receive", slotBody);
  const invokeEndpoints = Behave.useCallback(() => {
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
  const managed = Behave.useCallback(original, []);
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
  const managedClass = Behave.useCallback(CallbackConstructed, []);
  const managedConstructOnly = Behave.useCallback(constructOnlyCallback, []);
  const managedHybrid = Behave.useCallback(hybridCallback, []);
  const managedGenerator = Behave.useCallback(callbackGenerator, []);
  const managedAsyncGenerator = Behave.useCallback(callbackAsyncGenerator, []);
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
declare const detailedRef: UntypedModelRef;
type ReservedDependencyKey = "dispose" | "then" | "toJSON" | "constructor";
type AssertNever<Value extends never> = Value;
type DetailedReservedKeys = AssertNever<Extract<ReservedDependencyKey, keyof typeof detailedDependency>>;
declare const detailedReservedKeys: DetailedReservedKeys;
void detailedReservedKeys;

interface DetailedDependencyContractInput {
  readonly dependency: DependencyProxy<DetailedDependencySurface>;
  readonly ref: UntypedModelRef;
}

function DetailedDependencyContract(input: DetailedDependencyContractInput): undefined {
  const dependency: DependencyProxy = Behave.usePort(input.ref);
  Behave.useConnect(dependency.changed, input.dependency.receive);
  Behave.useConnect(input.dependency.changed, input.dependency.receive);
  Behave.useConnect(input.dependency.relay, input.dependency.receive);
  Behave.useConnect(input.dependency.changed, input.dependency.relay);
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
// @ts-expect-error The inherited Object constructor is not a Behave endpoint capability.
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
const typedSlotResult: undefined = detailedTypedRef.receive(1);
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
const typedDescriptor: BehaveInterfaceDescriptor = Behave.getInterface(detailedTypedRef);
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
// @ts-expect-error An untyped ref does not itself prove the consumer's Needs contract.
const rejectedUntypedNarrowing: TypedModelRef<DetailedDependencySurface> = detailedRef;
const anyTypedMember: any = anyTypedRef.arbitraryCommand;
const indexedTypedMember: Signal = indexedTypedRef.arbitraryCommand;
void rejectedUntypedNarrowing;
void anyTypedMember;
void indexedTypedMember;

function TypedModelRefContract() {
  const dependency: DependencyProxy<DetailedDependencySurface> = Behave.usePort(detailedTypedRef);
  const changed: Signal<readonly [value: number]> = dependency.changed;
  const receive = dependency.receive;
  // @ts-expect-error usePort(typedRef) preserves Needs instead of reopening a dynamic endpoint surface.
  dependency.runtimeEndpoint;
  // @ts-expect-error A typed external command view does not prove Model input/output metadata.
  const invalidObservation = Behave.useModel(detailedTypedRef);
  return { dependency, changed, receive, invalidObservation };
}
void TypedModelRefContract;

const dynamicRefResult: any = detailedRef.changed("runtime-validated payload");
void dynamicRefResult;
const detailedRoot: UntypedModelRef =
  Behave.createModel(String, 1);
const detailedInstance: ModelInstance<number, string> =
  Behave.createModel(String, 1);
const assertedCreatedTypedRef = detailedInstance as TypedModelRef<DetailedDependencySurface>;
void assertedCreatedTypedRef;

function AssemblyTypedRefContract(ref: typeof assertedCreatedTypedRef): undefined {
  const dependency = Behave.usePort(ref);
  Behave.useEffect(() => {
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
  const detailedObservation: ModelHandle<number, string> = Behave.useModel(input.instance);
  const boundaryObservation: ModelHandle<number, BoundaryState<string>> =
    Behave.useModel(input.boundaryInstance);
  return { detailedObservation, boundaryObservation };
}
void DetailedModelContract;
void detailedRoot;
void detailedInstance;

declare const schemaLessRef: UntypedModelRef;
const dynamicSignalResult: any = schemaLessRef.dynamicSignal("draft");
const disposeResult: void = schemaLessRef.dispose();
void dynamicSignalResult;
void disposeResult;

declare const schemaLessDependency: DependencyProxy;
const dynamicDependencyResult: any = schemaLessDependency.dynamicEndpoint("draft");
void dynamicDependencyResult;

function SchemaLessDependencyContract(input: UntypedModelRef): () => void {
  const dependency: DependencyProxy = Behave.usePort(input);
  const disconnect = Behave.useConnect(
    dependency.dynamicSource,
    dependency.dynamicDestination,
  );
  return disconnect;
}
void SchemaLessDependencyContract;

// Each removed name has its own assertion so one missing export cannot mask another.
// @ts-expect-error Detailed ModelRef schema facade was removed in favor of UntypedModelRef.
import type { ModelRef } from "behavon";
function RemovedTypedRelationshipOverloads() {
  // @ts-expect-error usePort no longer accepts an endpoint schema type argument.
  const removedTypedUse = Behave.usePort<DetailedDependencySurface>(schemaLessRef);
  // @ts-expect-error getInterface no longer accepts an endpoint schema type argument.
  const removedTypedGetInterface = Behave.getInterface<DetailedDependencySurface>(schemaLessRef);
  // @ts-expect-error A schema-less ModelInstance cannot be reclassified as a Port instance by useModel.
  const [removedOutput, removedSetter] = Behave.useModel<number, string, DetailedDependencySurface>(observedStringModel);
  // @ts-expect-error usePort requires a live UntypedModelRef; null is not an inert dependency sentinel.
  const removedNullableUse = Behave.usePort(null);
  const typedEndpoint = removedTypedUse.changed;
  const nullableEndpoint = removedNullableUse.changed;
  return {
    typedEndpoint,
    nullableEndpoint,
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
// @ts-expect-error BehavePublicApi duplicated the module surface and has been removed.
import type { BehavePublicApi } from "behavon";
// @ts-expect-error Snapshot channel inspection is an internal test seam, not a package export.
import { inspectSnapshotChannelForTests } from "behavon";
// @ts-expect-error createModelRoot was hard-renamed and is not a compatibility export.
Behave.createModelRoot;
