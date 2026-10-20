import Behavon, { createResource, FutureCancellationError, useEffect, useExport, useFuture, useReducer, useResource } from "behavon";
// @ts-expect-error Packed declarations do not expose the removed dependency Hook name.
import { use as removedUse } from "behavon";
import type {
  BehavonInterfaceDescriptor,
  DependencyProxy,
  BoundaryState,
  Model,
  ModelHandle,
  ModelInstance,
  MutableHandle,
  PortDescriptor,
  SnapshotId,
  SnapshotRootId,
  StateId,
  TransactionId,
  Signal,
  Slot,
  StateSetter,
  Reducer,
  ReducerDispatch,
  ResourceRequest,
  ResourceAbortSignal,
  ResourceSnapshot,
  Future,
  FutureAbortSignal,
  FutureSnapshot,
  TypedModelRef,
  UntypedModelRef,
} from "behavon";

export function PackedReactCorrespondingHookTypeFailures(): void {
  const memo: number = Behavon.useMemo(() => 1, []);
  /* eslint-disable behavon-hooks/exhaustive-deps -- packed type-only invalid reproductions exercise declaration-level rejection */
  // @ts-expect-error Packed useMemo requires an explicit dependency list.
  const missingMemoDependencies = Behavon.useMemo(() => 1);
  // @ts-expect-error Packed useMemo dependencies must be a readonly array.
  const malformedMemoDependencies = Behavon.useMemo(() => 1, "not dependencies");
  // @ts-expect-error Packed useMemo requires a callable factory.
  const malformedMemoFactory = Behavon.useMemo(1, []);
  /* eslint-enable behavon-hooks/exhaustive-deps */

  const external: number = Behavon.useSyncExternalStore(
    () => () => undefined,
    () => 1,
  );
  // @ts-expect-error Packed subscribe must return an unsubscribe function.
  const malformedSubscribe = Behavon.useSyncExternalStore(() => undefined, () => 1);
  // @ts-expect-error Packed getSnapshot must be callable.
  const malformedSnapshotReader = Behavon.useSyncExternalStore(() => () => undefined, 1);

  // @ts-expect-error Packed Effect setup cannot return a Promise cleanup.
  useEffect(() => Promise.resolve(), []);
  // @ts-expect-error Packed Effect cleanup must be a function when setup returns a value.
  useEffect(() => 1, []);
  void [memo, missingMemoDependencies, malformedMemoDependencies, malformedMemoFactory];
  void [external, malformedSubscribe, malformedSnapshotReader];
}

type PackageStopReason = { kind: "requested" | "lost" };
const packageResource = createResource({
  open: ({ input }: { input: { seed: number }; signal: ResourceAbortSignal; terminated(reason: PackageStopReason): void }) => ({ value: input.seed }),
  close: (_context: { resource: { value: number }; reason?: PackageStopReason }) => undefined,
  abort: (_context: { resource?: { value: number }; reason?: PackageStopReason }) => undefined,
  actions: {
    read: ({ resource }: { resource: { value: number }; signal: ResourceAbortSignal }) => resource.value,
    asyncLike: ({ resource }: { resource: { value: number }; signal: ResourceAbortSignal }): PromiseLike<number> =>
      Promise.resolve(resource.value),
  },
});
const packageResourceWithoutActions = createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});

export function usePackedResourceContract(seed: number) {
  const [snapshot, resource] = useResource(packageResource, { seed });
  const current: ResourceSnapshot<PackageStopReason> = snapshot;
  const request = undefined as unknown as ReturnType<typeof resource.open>;
  const checkedRequest: ResourceRequest = request;
  const value = undefined as unknown as ReturnType<typeof resource.read>;
  const checkedValue: number = value;
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- packed type-only managed action signature probe is never executed
  const normalized: Promise<number> = resource.asyncLike();
  const [, noActions] = useResource(packageResourceWithoutActions, undefined);
  // @ts-expect-error Packed Resource declarations without actions do not expose arbitrary members.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- packed type-only invalid action probe is never executed
  noActions.unknownAction();
  // @ts-expect-error Packed useResource preserves its input shape.
  // eslint-disable-next-line behavon-hooks/canonical-api -- package type-negative probe intentionally discards the invalid call
  useResource(packageResource, { seed: "wrong" });
  // @ts-expect-error Packed managed action preserves its argument list.
  const wrongReadArguments: Parameters<typeof resource.read> = [1];
  void wrongReadArguments;
  return { current, request: checkedRequest, value: checkedValue, normalized };
}

export function usePackedFutureContract(seed: number) {
  const future = useFuture(async (input: number, context) => {
    const signal: FutureAbortSignal = context.signal;
    const abortListener = () => undefined;
    signal.addEventListener("abort", abortListener, { once: true });
    signal.removeEventListener("abort", abortListener);
    signal.throwIfAborted();
    if (signal.aborted) context.abort(signal.reason);
    return input + seed;
  }, { concurrency: "serial" });
  const checked: Future<number, number> = future;
  const snapshot: FutureSnapshot<number> = checked.snapshot();
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- packed type-only Future completion signature probe is never executed
  const completion: Promise<number> = checked.start(seed);
  checked.rejected.subscribe(({ reason }) => {
    if (reason instanceof FutureCancellationError) {
      const kind: "explicit" | "superseded" | "self" | "owner-dispose" = reason.kind;
      void kind;
    }
  });
  // @ts-expect-error Packed Future input is preserved.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- packed type-negative probe is never executed
  checked.start("wrong");
  // @ts-expect-error useFuture requires an explicit supported concurrency mode.
  const invalidFuture = useFuture(async () => 1, {});
  invalidFuture.snapshot();
  return { snapshot, completion };
}

const packedReducer: Reducer<number, [number]> = (state, action) => state + action;
const packedDispatchType = undefined as unknown as ReducerDispatch<[number]>;
void packedReducer;
void packedDispatchType;

export function usePackedReducerContract() {
  const [count, dispatch] = useReducer((state: number, action: number) => state + action, 0);
  const state: number = count;
  const result: void = dispatch(1);
  // @ts-expect-error Packed reducer dispatch rejects a missing action.
  dispatch();
  // @ts-expect-error Packed reducer dispatch rejects more than one action.
  dispatch(1, 2);
  const [initialized] = Behavon.useReducer(
    (current: number, action: number) => current + action,
    "3",
    (initial: string) => Number(initial),
  );
  return { state, result, initialized };
}

void removedUse;
// @ts-expect-error Packed default facade has no old compatibility member.
Behavon.use;

interface PackagePort {
  snapshotId: SnapshotRootId<number>;
  changed: Signal<[value: number]>;
  receive: Slot<[value: number]>;
}

const packagePort = Behavon.createPort<PackagePort>({
  snapshotId: Behavon.SnapshotType(),
  changed: Behavon.SignalType(),
  receive: Behavon.SlotType(),
});
const packagePortDescriptor: PortDescriptor<PackagePort> = packagePort;

type PackageUnionPort = { changed: Signal } | { receive: Slot };
// @ts-expect-error Packed createPort rejects a union Port.
Behavon.createPort<PackageUnionPort>({ changed: Behavon.SignalType() });
interface PackageUnionMemberPort {
  endpoint: Signal | Slot;
}
// @ts-expect-error Packed createPort rejects union members.
Behavon.createPort<PackageUnionMemberPort>({ endpoint: Behavon.SignalType() });

declare const packagePortSymbol: unique symbol;
interface PackageSymbolKeyPort {
  [packagePortSymbol]: Signal;
}
// @ts-expect-error Packed createPort rejects non-string top-level Port keys.
Behavon.createPort<PackageSymbolKeyPort>({ [packagePortSymbol]: Behavon.SignalType() });

interface PackageNumberKeyPort {
  0: Signal;
}
// @ts-expect-error Packed createPort rejects numeric top-level Port keys.
Behavon.createPort<PackageNumberKeyPort>({ 0: Behavon.SignalType() });

interface PackageEmptyNamePort {
  "": Signal;
}
// @ts-expect-error Packed createPort rejects an empty unified-namespace member name.
Behavon.createPort<PackageEmptyNamePort>({ "": Behavon.SignalType() });

interface PackageProtoNamePort {
  __proto__: Signal;
}
// @ts-expect-error Packed createPort rejects the unsafe __proto__ member name.
Behavon.createPort<PackageProtoNamePort>({ __proto__: Behavon.SignalType() });

interface PackageEmptyPort {}
// @ts-expect-error Packed createPort requires a non-empty finite Port interface.
Behavon.createPort<PackageEmptyPort>({});
// @ts-expect-error Packed object cannot associate a descriptor with a Model body.
Behavon.createPort<object>({});
// @ts-expect-error Packed {} cannot associate a descriptor with a Model body.
Behavon.createPort<{}>({});

interface PackageCallablePort {
  (value: number): void;
  fire: Signal;
}
// @ts-expect-error Packed Ports reject call signatures.
Behavon.createPort<PackageCallablePort>({ fire: Behavon.SignalType() });

interface PackageConstructablePort {
  new (value: number): object;
  fire: Signal;
}
// @ts-expect-error Packed Ports reject construct signatures.
Behavon.createPort<PackageConstructablePort>({ fire: Behavon.SignalType() });

interface PackageSignalSnapshotPort {
  endpoint: Signal<[value: number]> & SnapshotRootId<number>;
}
// @ts-expect-error Packed createPort rejects endpoint/snapshot intersections.
Behavon.createPort<PackageSignalSnapshotPort>({ endpoint: Behavon.SignalType() });

interface PackageAugmentedSignalPort {
  endpoint: Signal<[value: number]> & { label: string };
}
// @ts-expect-error Packed createPort rejects augmented endpoint promises.
Behavon.createPort<PackageAugmentedSignalPort>({ endpoint: Behavon.SignalType() });

interface PackageOverloadedSignalPort {
  endpoint: Signal<[value: number]> & Signal<[value: string]>;
}
// @ts-expect-error Packed createPort rejects overloaded endpoint promises.
Behavon.createPort<PackageOverloadedSignalPort>({ endpoint: Behavon.SignalType() });

interface PackageIndexedSnapshotPort {
  app: SnapshotRootId<number> & Readonly<Record<string, SnapshotId<number>>>;
}
// @ts-expect-error Packed createPort rejects open nested snapshot identities.
Behavon.createPort<PackageIndexedSnapshotPort>({ app: Behavon.SnapshotType() });

declare const packageSnapshotChild: unique symbol;
interface PackageSymbolSnapshotPort {
  app: SnapshotRootId<number> & { [packageSnapshotChild]: SnapshotId<string> };
}
// @ts-expect-error Packed createPort rejects custom symbol snapshot children.
Behavon.createPort<PackageSymbolSnapshotPort>({ app: Behavon.SnapshotType() });

interface PackageReservedMarkerSnapshotPort {
  app: SnapshotRootId<number> & { $: SnapshotId<string> };
}
Behavon.createPort<PackageReservedMarkerSnapshotPort>({
  // @ts-expect-error Packed snapshot Ports reserve $ for the payload marker.
  app: { $: Behavon.SnapshotType() },
});

interface PackageProtoSnapshotPort {
  app: SnapshotRootId<number> & { __proto__: SnapshotId<string> };
}
Behavon.createPort<PackageProtoSnapshotPort>({
  // @ts-expect-error Packed snapshot Ports reject recursive __proto__ keys.
  app: { $: Behavon.SnapshotType(), __proto__: Behavon.SnapshotType() },
});

interface PackageCallableSnapshotRootPort {
  app: SnapshotRootId<number> & ((value: number) => string);
}
Behavon.createPort<PackageCallableSnapshotRootPort>({
  // @ts-expect-error Packed snapshot roots reject call signatures.
  app: Behavon.SnapshotType(),
});

interface PackageConstructableSnapshotRootPort {
  app: SnapshotRootId<number> & { new (value: number): object };
}
Behavon.createPort<PackageConstructableSnapshotRootPort>({
  // @ts-expect-error Packed snapshot roots reject construct signatures.
  app: Behavon.SnapshotType(),
});

type PackageCallableSnapshotBranch = {
  child: SnapshotId<number>;
} & ((value: number) => string);
interface PackageCallableSnapshotBranchPort {
  app: SnapshotRootId<number> & { branch: PackageCallableSnapshotBranch };
}
Behavon.createPort<PackageCallableSnapshotBranchPort>({
  app: {
    $: Behavon.SnapshotType(),
    // @ts-expect-error Packed nested snapshot objects reject call signatures.
    branch: { child: Behavon.SnapshotType() },
  },
});

type PackageConstructableSnapshotBranch = {
  child: SnapshotId<number>;
} & { new (value: number): object };
interface PackageConstructableSnapshotBranchPort {
  app: SnapshotRootId<number> & { branch: PackageConstructableSnapshotBranch };
}
Behavon.createPort<PackageConstructableSnapshotBranchPort>({
  app: {
    $: Behavon.SnapshotType(),
    // @ts-expect-error Packed nested snapshot objects reject construct signatures.
    branch: { child: Behavon.SnapshotType() },
  },
});

interface PackageNestedRootSnapshotPort {
  app: SnapshotRootId<number> & { child: SnapshotRootId<string> };
}
Behavon.createPort<PackageNestedRootSnapshotPort>({
  app: {
    $: Behavon.SnapshotType(),
    // @ts-expect-error Packed recursive snapshot members cannot promise an independent root.
    child: Behavon.SnapshotType(),
  },
});

interface PackageNumberSnapshotPort {
  app: SnapshotRootId<number> & { 0: SnapshotId<string> };
}
// @ts-expect-error Packed createPort rejects numeric snapshot children.
Behavon.createPort<PackageNumberSnapshotPort>({ app: Behavon.SnapshotType() });

const PackagePortModel: Model<number, string, PackagePort> = (input) => {
  Behavon.useExport(packagePort, "snapshotId");
  const changed = Behavon.useCallback((value: number) => value, []);
  Behavon.useSignal(packagePort, "changed", changed);
  const exportedChanged: Signal<readonly [value: number]> = Behavon.useExport(packagePort, "changed");
  void exportedChanged;
  const receive = Behavon.useCallback((value: number) => value, []);
  Behavon.useSlot(packagePort, "receive", receive);
  return String(input);
};
const packagePortInstance: ModelInstance<number, string, PackagePort> = Behavon.createModel(
  PackagePortModel,
  1,
);
const packagePortSnapshot: SnapshotRootId<number> = packagePortInstance.snapshotId;
void [packagePortDescriptor, packagePortSnapshot];

export function useNamedExportContract(): number {
  const exported = useExport(() => ({ value: 1 as const }));
  return exported.value;
}

export function RejectFunctionExportContract(): undefined {
  // @ts-expect-error Packed public exports reject direct function-valued properties.
  Behavon.useExport(() => ({ command: () => undefined }));
  return undefined;
}

export function useSnapshotIdentityContract() {
  const snapshots = Behavon.createId({
    $: Behavon.SnapshotType<{ readonly version: number }>(),
    change: Behavon.SnapshotType<string>(),
  });
  const root: SnapshotRootId<{ readonly version: number }> = snapshots;
  const child: SnapshotId<string> = snapshots.change;
  const direct = Behavon.createId(Behavon.SnapshotType<number>());
  const [current, publish] = Behavon.useSnapshot(snapshots);
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only packed signature probe is never executed
  publish({ version: 1 });
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only packed signature probe is never executed
  publish(snapshots.change, "next");
  // @ts-expect-error Built snapshot publishers reject zero arguments.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid packed arity probe is never executed
  publish();
  // @ts-expect-error Built snapshot publishers reject three or more arguments.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid packed arity probe is never executed
  publish(snapshots.change, "next", "extra");
  const [directCurrent, directPublish] = Behavon.useSnapshot(direct);
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only packed root-only signature probe is never executed
  directPublish(1);
  const directRead: number | undefined = Behavon.getSnapshot(direct)();
  // @ts-expect-error Built root-only publishers have no child target overload.
  // eslint-disable-next-line behavon-hooks/evaluation-purity -- type-only invalid packed signature probe is never executed
  directPublish(snapshots.change, "invalid");
  // @ts-expect-error Built child identities cannot own a snapshot family.
  Behavon.useSnapshot(snapshots.change);
  // @ts-expect-error Built createId roots must declare a payload.
  Behavon.createId({ change: Behavon.SnapshotType<string>() });
  // @ts-expect-error Built descriptors validate every child recursively.
  Behavon.createId({ $: Behavon.SnapshotType<number>(), invalid: 1 });
  // @ts-expect-error Built nested $ declarations require SnapshotType markers.
  Behavon.createId({
    $: Behavon.SnapshotType<number>(),
    group: { $: "invalid", child: Behavon.SnapshotType<string>() },
  });
  return { root, child, current, directCurrent, directRead };
}

const packageTransactionStates = Behavon.createId({
  count: Behavon.StateType<number>(),
});
const packageStateId: StateId<number> = packageTransactionStates.count;

export function useTransactionContract(): number {
  const [count, setCount] = Behavon.useLabelState(packageStateId, 0);
  const execute = Behavon.useCallback(() => {
    const id: TransactionId = Behavon.createId();
    Behavon.transaction.start(id, [packageStateId]);
    Behavon.transaction.run(id, () => setCount((previous) => previous + 1));
    // @ts-expect-error Built transaction.run rejects async bodies.
    Behavon.transaction.run(id, async () => 1); // eslint-disable-line behavon-hooks/evaluation-purity -- type-only invalid synchronous-contract probe
    const thenableBody = (): PromiseLike<number> => Promise.resolve(1);
    // @ts-expect-error Built transaction.run rejects PromiseLike-returning bodies.
    Behavon.transaction.run(id, thenableBody);
    Behavon.transaction.commit(id);
  }, [setCount]);
  Behavon.useSignal("packageTransaction", execute);
  return count;
}

export function useNamedEffectContract(): void {
  useEffect(() => undefined, []);
}

export function useMutableContract(initial: { readonly value: number }) {
  const mutable: MutableHandle<{ readonly value: number }> = Behavon.useMutable(initial);
  const current: { readonly value: number } = mutable.get();
  mutable.set({ value: current.value + 1 });
  mutable.set(previous => ({ value: previous.value + 1 }));
  // @ts-expect-error Built useMutable deliberately has no React DOM-ref .current surface.
  mutable.current;
  // @ts-expect-error Built MutableHandle preserves the initial value type.
  mutable.set("wrong");
  return mutable;
}

export function useStateOverloadContract() {
  const omitted = Behavon.useState();
  const explicit = Behavon.useState<number>();
  const initialized = Behavon.useState(1);
  const lazy = Behavon.useState(() => "ready");
  const exactOmitted: readonly [undefined, StateSetter<undefined>] = omitted;
  const exactExplicit: readonly [number | undefined, StateSetter<number | undefined>] = explicit;
  const exactInitialized: readonly [number, StateSetter<number>] = initialized;
  const exactLazy: readonly [string, StateSetter<string>] = lazy;
  return { exactOmitted, exactExplicit, exactInitialized, exactLazy } as const;
}

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

function CallbackFunctionShapeContract() {
  const callOnly = function (this: { readonly base: number }, increment: number): string {
    return String(this.base + increment);
  };
  const managedCallOnly = Behavon.useCallback(callOnly, []);
  const managedClass = Behavon.useCallback(CallbackConstructed, []);
  const managedConstructOnly = Behavon.useCallback(constructOnlyCallback, []);
  const managedHybrid = Behavon.useCallback(hybridCallback, []);
  const exactCallOnly: typeof callOnly = managedCallOnly;
  const exactClass: typeof CallbackConstructed = managedClass;
  const exactConstructOnly: ConstructOnlyCallback = managedConstructOnly;
  const exactHybrid: HybridCallback = managedHybrid;
  const callResult: string = managedCallOnly.call({ base: 40 }, 2);
  const classInstance: CallbackConstructed = new managedClass(1);
  const constructOnlyInstance: { readonly value: number } = new managedConstructOnly(2);
  const hybridCallResult: string = managedHybrid.call({ base: 40 }, 2);
  const hybridConstructResult: { readonly label: string } = new managedHybrid("managed");
  return {
    exactCallOnly,
    exactClass,
    exactConstructOnly,
    exactHybrid,
    callResult,
    classInstance,
    constructOnlyInstance,
    hybridCallResult,
    hybridConstructResult,
  };
}
void CallbackFunctionShapeContract;

declare const symbolEndpoint: unique symbol;

export interface ConsumerEndpoints {
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

function Child(input: number): number {
  return input;
}

export const commonModel: Model = input => input;
export const detailedModel: Model<number, string> = input => String(input);

export function callCommonDependency(dependency: DependencyProxy) {
  return dependency.command("draft");
}

export function callDetailedDependency(dependency: DependencyProxy<ConsumerEndpoints>) {
  return dependency.changed(1);
}

export function useConnectDetailedDependency(dependency: DependencyProxy<ConsumerEndpoints>) {
  const disconnect = Behavon.useConnect(dependency.changed, dependency.receive);
  return disconnect;
}

export function useConnectDetailedDualRole(dependency: DependencyProxy<ConsumerEndpoints>) {
  Behavon.useConnect(dependency.relay, dependency.receive);
  const disconnect = Behavon.useConnect(dependency.changed, dependency.relay);
  return disconnect;
}

export function acceptCommonModelHandle(handle: ModelHandle) {
  return handle;
}

export function acceptDetailedModelHandle(handle: ModelHandle<number, number>) {
  return handle;
}

declare const detailedDependency: DependencyProxy<ConsumerEndpoints>;
type ReservedDependencyKey = "dispose" | "then" | "toJSON" | "constructor";
type AssertNever<Value extends never> = Value;
type DetailedReservedKeys = AssertNever<Extract<ReservedDependencyKey, keyof typeof detailedDependency>>;
declare const detailedReservedKeys: DetailedReservedKeys;
void detailedReservedKeys;
// @ts-expect-error Detailed dependencies preserve endpoint payload validation.
detailedDependency.changed("wrong payload");
// @ts-expect-error Slot-only dependency capabilities cannot be called directly.
detailedDependency.receive(1);
const exportedCount: number = detailedDependency.count;
const exportedSettings: { readonly enabled: boolean } = detailedDependency.settings;
void exportedCount;
void exportedSettings;
// @ts-expect-error Dependency export properties are readonly.
detailedDependency.count = 2;
// @ts-expect-error Optional endpoints are not guaranteed capabilities.
detailedDependency.optional;
// @ts-expect-error A union with a non-endpoint member is not a guaranteed capability.
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

declare const typedRef: TypedModelRef<ConsumerEndpoints>;
declare const plainTypedShape: {
  readonly changed: Signal<readonly [value: number]>;
  readonly relay: Signal<readonly [value: number]> & Slot<readonly [value: number]>;
  readonly voidCommand: (value: string) => void;
  readonly undefinedCommand: () => undefined;
  dispose(): void;
};
declare const anyTypedRef: TypedModelRef<any>;
declare const indexedTypedRef: TypedModelRef<Readonly<Record<string, Signal>>>;

const typedSignalResult: undefined = typedRef.changed(1);
const typedRelayResult: undefined = typedRef.relay(1);
const typedVoidResult: void = typedRef.voidCommand("command");
const typedUndefinedResult: undefined = typedRef.undefinedCommand();
const typedSlotResult: undefined = typedRef.receive(1);
const typedNumberResult: number = typedRef.returnsNumber();
const typedCount: number = typedRef.count;
const typedSettings: { readonly enabled: boolean } = typedRef.settings;
const typedOptional: Signal<readonly [value: number]> | undefined = typedRef.optional;
const typedUncertain: Signal<readonly [value: number]> | { readonly fallback: true } =
  typedRef.uncertain;
const typedThenResult: undefined = typedRef.then();
const typedToJSONResult: undefined = typedRef.toJSON();
const typedConstructorResult: undefined = typedRef.constructor();
const typedSymbolResult: undefined = typedRef[symbolEndpoint]();
const typedUnchecked: any = typedRef.unchecked;
const typedImpossible: never = typedRef.impossible;
const typedDisposeResult: void = typedRef.dispose();
const typedDescriptor: BehavonInterfaceDescriptor = Behavon.getInterface(typedRef);
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
void typedThenResult;
void typedToJSONResult;
void typedConstructorResult;
void typedSymbolResult;
void typedUnchecked;
void typedImpossible;
void typedDisposeResult;
void typedDescriptor;

// @ts-expect-error Built typed refs preserve Signal payload validation.
typedRef.changed("wrong payload");
// @ts-expect-error Built typed refs reject unknown commands.
typedRef.typo();
// @ts-expect-error The built opaque identity rejects structurally similar plain objects.
const rejectedPlainTypedRef: TypedModelRef<ConsumerEndpoints> = plainTypedShape;
void rejectedPlainTypedRef;
declare const packageUntypedRef: UntypedModelRef;
// @ts-expect-error A built untyped ref does not itself prove the consumer's Needs contract.
const rejectedUntypedNarrowing: TypedModelRef<ConsumerEndpoints> = packageUntypedRef;
const anyTypedMember: any = anyTypedRef.arbitraryCommand;
const indexedTypedMember: Signal = indexedTypedRef.arbitraryCommand;
void rejectedUntypedNarrowing;
void anyTypedMember;
void indexedTypedMember;

export function useTypedRef(): unknown {
  const dependency: DependencyProxy<ConsumerEndpoints> = Behavon.usePort(typedRef);
  const changed: Signal<readonly [value: number]> = dependency.changed;
  const receive = dependency.receive;
  // @ts-expect-error Built usePort(typedRef) preserves Needs instead of reopening dynamic endpoints.
  dependency.runtimeEndpoint;
  // @ts-expect-error A built typed external view is not a Model input/output capability.
  const [invalidOutput, invalidSetter] = Behavon.useModel(typedRef);
  void dependency;
  void changed;
  void receive;
  return { invalidOutput, invalidSetter };
}

declare const detailedModelHandle: ModelHandle<number, number>;
// @ts-expect-error Detailed Model handles preserve input validation.
detailedModelHandle[1]("wrong input");

export function useDependency(ref: UntypedModelRef): DependencyProxy {
  const dependency = Behavon.usePort(ref);
  return dependency;
}

export function useSchemaLessDependency(ref: UntypedModelRef) {
  const dependency = Behavon.usePort(ref);
  return dependency;
}

export function useConnectSchemaLessDependencies(sourceRef: UntypedModelRef, destinationRef: UntypedModelRef) {
  const sourceDependency = Behavon.usePort(sourceRef);
  const destinationDependency = Behavon.usePort(destinationRef);
  const source = sourceDependency.source;
  const destination = destinationDependency.destination;
  const disconnect = Behavon.useConnect(source, destination);
  return disconnect;
}

export function useInferredModelHandle(instance: ModelInstance<number, number>) {
  const handle: ModelHandle<number, number> = Behavon.useModel(instance);
  return handle;
}

export function createInferredBoundaryModel(): Model<number, BoundaryState<number>> {
  return Behavon.boundary(Child);
}

export function createSchemaLessRoot(input: number): UntypedModelRef {
  const ref = Behavon.createModel(Child, input);
  ref.dynamicSignal(input);
  return ref;
}

export function createRoot(input: number): UntypedModelRef {
  return Behavon.createModel(Child, input);
}

const createdInstance = Behavon.createModel(Child, 1);
const createdUntypedRef: UntypedModelRef = createdInstance;
const assertedCreatedTypedRef = createdInstance as TypedModelRef<ConsumerEndpoints>;
void createdUntypedRef;
void assertedCreatedTypedRef;

export function useAssemblyTypedRef(ref: typeof assertedCreatedTypedRef): undefined {
  const dependency = Behavon.usePort(ref);
  Behavon.useEffect(() => {
    dependency.changed(1);
    // @ts-expect-error Built assembly typed usePort preserves the Signal payload contract.
    dependency.changed("wrong payload");
    // @ts-expect-error Built assembly typed usePort does not reopen unknown endpoint names.
    dependency.unknownEndpoint();
  }, [dependency]);
  return undefined;
}

export function useDetailedModelHandle(
  instance: ModelInstance<number, number>,
): ModelHandle<number, number> {
  const handle = Behavon.useModel(instance);
  return handle;
}

export function useEffectWithoutDependencies() {
  Behavon.useEffect(() => undefined);
}

export function useInspectTypedDependency(ref: UntypedModelRef) {
  const dependency = Behavon.usePort(ref);
  return Behavon.getInterface(dependency);
}

export const inspectTarget = Behavon.getInterface;

interface CallbackReceiver {
  readonly base: number;
}

export function useCallbackWithReceiver() {
  const original = function (this: CallbackReceiver, increment: number, suffix?: string): string {
    return `${this.base + increment}${suffix ?? ""}`;
  };
  const managed = Behavon.useCallback(original, []);
  const exact: typeof original = managed;
  const result: string = managed.call({ base: 40 }, 2, "!");
  void exact;
  // @ts-expect-error Built package declarations preserve the original explicit this parameter.
  managed.call({ missing: true }, 2);
  // @ts-expect-error Built package declarations preserve positional argument inference.
  managed.call({ base: 40 }, "wrong");
  return { managed, result };
}

declare const plainFunction: (...args: readonly unknown[]) => undefined;
function InvalidConnectionContract(): undefined {
  // @ts-expect-error Ordinary functions are not Behavon endpoint capabilities.
  Behavon.useConnect(plainFunction, plainFunction);
  return undefined;
}
void InvalidConnectionContract;

function RemovedTypedRelationshipOverloads(
  ref: UntypedModelRef,
  instance: ModelInstance<number, number>,
) {
  // @ts-expect-error Built declarations expose only schema-free usePort(ref).
  const removedTypedUse = Behavon.usePort<ConsumerEndpoints>(ref);
  // @ts-expect-error Built declarations expose only schema-free getInterface(target).
  const removedTypedGetInterface = Behavon.getInterface<ConsumerEndpoints>(ref);
  // @ts-expect-error A schema-less ModelInstance cannot be reclassified as a Port instance by useModel.
  const [removedOutput, removedSetter] = Behavon.useModel<number, number, ConsumerEndpoints>(instance);
  // @ts-expect-error Built declarations require a live UntypedModelRef and reject null.
  const removedNullableUse = Behavon.usePort(null);
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

// @ts-expect-error The legacy ModelRef export remains absent from the built package.
import type { ModelRef } from "behavon";

// @ts-expect-error The built package exposes only the hard-renamed createModel API.
Behavon.createModelRoot;
