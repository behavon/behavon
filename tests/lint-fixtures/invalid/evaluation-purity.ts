import Behavon, { transaction, type DependencyProxy, type StateSetter, type TypedModelRef } from "behavon";

let externalCount = 0;
const externalObject = { value: 0 };
const externalValues: number[] = [];
const externalMap = new Map<string, number>();
const externalSet = new Set<number>(); const evaluationSnapshot = Behavon.createId(Behavon.SnapshotType<number>()); const callApplySnapshot = Behavon.createId(Behavon.SnapshotType<number>()); const storedSnapshot = Behavon.createId(Behavon.SnapshotType<number>()); const storedCallbackSnapshot = Behavon.createId(Behavon.SnapshotType<number>());

export function MutationModel(input: {
  value: number;
  values: number[];
  map: Map<string, number>;
  set: Set<number>;
}): number {
  externalCount = 1;
  externalCount += 1;
  externalCount++;
  externalObject.value = 1;
  const alias = externalObject;
  alias.value++;
  externalValues.push(1);
  input.value = 1;
  input.values.push(1);
  externalMap.set("value", 1);
  externalSet.add(1);
  input.map.delete("value");
  input.set.clear();

  const [state] = Behavon.useState({ value: 0 });
  const memo = Behavon.useMemo(() => ({ value: 0 }), []);
  const [stateMap, setStateMap] = Behavon.useState(new Map<string, number>());
  const memoSet = Behavon.useMemo(() => new Set<number>(), []);
  const setterObject = setStateMap as StateSetter<Map<string, number>> & { extra?: boolean };
  const callback = Behavon.useCallback(() => {
    state.value = 1;
    memo.value = 1;
    stateMap.set("value", 1);
    memoSet.add(1);
    setterObject.extra = true;
  }, [memo, state]);
  Behavon.useSignal(mutationModelPort, "callback", callback);

  const random = Date.now() + Math.random() + performance.now();
  crypto.randomUUID();
  new Date();
  return random;
}

let destructuredExternal = 0;
const destructuredObject = { value: 0 };
const destructuredKeys = { key: "" };

export function DestructuringMutationModel(input: { value: number }): number {
  const [epoch] = Behavon.useState(0);
  [destructuredExternal] = [1];
  ({ value: destructuredObject.value } = { value: 2 });
  ({ value: input.value } = { value: 3 });
  for (destructuredExternal of [1]) void destructuredExternal;
  for (destructuredKeys.key in { value: 1 }) void destructuredKeys.key;
  Reflect.set(destructuredObject, "value", 4);
  Reflect.set(input, "value", 5);
  return epoch;
}

export function EvaluationOperationModel(): undefined {
  const [, publish] = Behavon.useSnapshot(evaluationSnapshot);
  const body = Behavon.useCallback(() => undefined, []);
  const signal = Behavon.useSignal(evaluationOperationModelPort, "signal", body);
  let assignedState: { value: number };
  let assignedSetter: StateSetter<{ value: number }>;
  [assignedState, assignedSetter] = Behavon.useState({ value: 0 });
  const assignedSetterObject = assignedSetter as StateSetter<{ value: number }> & { extra?: boolean };
  const publishObject = publish as typeof publish & { extra?: boolean };
  const signalObject = signal as typeof signal & { extra?: boolean };
  assignedState.value = 1;
  assignedSetterObject.extra = true;
  publishObject.extra = true;
  signalObject.extra = true;
  Object.assign(publish, { extra: true });
  publish(1);
  signal();

  const immediate = Behavon.useCallback(() => {
    publish(2);
  }, [publish]);
  const immediateAlias = immediate;
  immediateAlias.call(undefined);
  const applied = Behavon.useCallback(() => {
    signal();
  }, [signal]);
  const appliedAlias = applied;
  appliedAlias.apply(undefined, []);
  return undefined;
}

export function MemoFactoryModel(): number {
  const value = Behavon.useMemo(() => {
    externalObject.value = 2;
    return 1;
  }, []);
  return value;
}

export function SynchronousHookCallbackModel(): number {
  const [lazy] = Behavon.useState(() => {
    externalObject.value = 3;
    return 1;
  });
  const snapshot = Behavon.useSyncExternalStore(
    () => () => undefined,
    () => {
      externalObject.value = 4;
      return 2;
    },
  );
  return lazy + snapshot;
}

function HookFreeModel(): number {
  externalCount = 2;
  return externalCount;
}

const HookFreeAlias = HookFreeModel;
export const hookFreeInstance = Behavon.createModel(HookFreeAlias, undefined);

function mutateFromLocalHelper(): void {
  externalCount = 3;
}

export function LocalHelperModel(): number {
  const [value] = Behavon.useState(0);
  mutateFromLocalHelper();
  return value;
}

export function useHookWithoutHookCalls(): number {
  externalCount = 4;
  return externalCount;
}

export function OperationCallApplyModel(): undefined {
  const [, publish] = Behavon.useSnapshot(callApplySnapshot);
  const body = Behavon.useCallback(() => undefined, []);
  const signal = Behavon.useSignal(operationCallApplyModelPort, "call.apply", body);
  const publishAlias = publish;
  const signalAlias = signal;
  publish.call(undefined, 1);
  publishAlias.apply(undefined, [2]);
  signal.call(undefined);
  signalAlias.apply(undefined, []);
  return undefined;
}

export function DeferredImmutableMutationModel(input: { value: number }): undefined {
  const [state] = Behavon.useState({ value: 0 });
  Behavon.useEffect(() => {
    Object.assign(state, { value: 1 });
    Reflect.set(input, "value", 2);
    Object.assign(externalObject, { value: 3 });
  }, [input, state]);
  const deferred = Behavon.useCallback(() => {
    Reflect.set(state, "value", 4);
  }, [state]);
  Behavon.useSignal(deferredImmutableMutationModelPort, "deferred.immutable", deferred);
  return undefined;
}

function mutateImmutableHelper(value: { value: number }): void {
  const alias = value;
  alias.value += 1;
}

const mutateImmutableAlias = mutateImmutableHelper;

function relayImmutableHelper(value: { value: number }): void {
  mutateImmutableAlias(value);
}

function mutateExternalArgument(value: { value: number }): void {
  value.value += 1;
}

function mutateMixedArgument(value: { value: number }): void {
  value.value += 1;
}

function mutateDeferredArgument(value: { value: number }): void {
  Object.assign(value, { value: 2 });
}

export function HelperArgumentProvenanceModel(): number {
  const [state] = Behavon.useState({ value: 0 });
  const local = { value: 0 };
  relayImmutableHelper(state);
  mutateExternalArgument(externalObject);
  mutateMixedArgument(local);
  mutateMixedArgument(state);
  Behavon.useEffect(() => {
    mutateDeferredArgument(state);
  }, [state]);
  return state.value;
}

export function MemberHookAssignmentModel(): number {
  const box: { state?: { value: number } } = {};
  const slots: Array<{ value: number } | undefined> = [];
  box.state = Behavon.useMemo(() => ({ value: 0 }), []);
  slots[0] = Behavon.useMemo(() => ({ value: 0 }), []);
  box.state.value = 1;
  slots[0]!.value = 1;
  Behavon.useEffect(() => {
    Reflect.set(box.state!, "value", 2);
  }, [box.state]);
  return box.state.value + slots[0]!.value;
}

function useDefaultExportHook(): number {
  externalCount = 5;
  return externalCount;
}

export default useDefaultExportHook;

function assignedModelBody(): number {
  externalCount = 6;
  return externalCount;
}

let assignedModelAlias: typeof assignedModelBody;
assignedModelAlias = assignedModelBody;
export const assignedModelInstance = Behavon.createModel(assignedModelAlias, undefined);

function latestAssignedHelper(): void {
  externalCount = 7;
}

let assignedHelperAlias: () => void;
assignedHelperAlias = latestAssignedHelper;
const assignedHelperBox: { run: () => void } = { run: () => undefined };
assignedHelperBox.run = latestAssignedHelper;

export function LatestAssignedHelperModel(): number {
  const [value] = Behavon.useState(0);
  assignedHelperAlias();
  assignedHelperBox.run();
  return value;
}

type NamedValues = number[];
type NamedMap = Map<string, number>;
type SameMapUnion = NamedMap | Map<string, number>;

interface NamedCollectionInput {
  values: NamedValues;
  map: NamedMap;
  sameMap: SameMapUnion;
}

export function NamedCollectionShapeModel({
  values,
  map,
  sameMap,
}: NamedCollectionInput): number {
  const [value] = Behavon.useState(0);
  values.push(value);
  map.set("value", value);
  sameMap.delete("missing");
  return value;
}

export function LazyHookCollectionModel(): number {
  const [lazyArray] = Behavon.useState(() => [] as number[]);
  const [lazyMap] = Behavon.useState(() => new Map<string, number>());
  const memoArray = Behavon.useMemo(() => Array<number>(), []);
  const memoSet = Behavon.useMemo(() => new Set<number>(), []);
  lazyArray.push(1);
  lazyMap.set("value", 1);
  memoArray.push(1);
  memoSet.add(1);
  return lazyArray.length;
}

export function NestedContainerProvenanceModel(input: { value: number }): number {
  const [state] = Behavon.useState({ value: 0 });
  const box: { state?: { value: number } } = {};
  const slots: Array<{ value: number } | undefined> = [];
  box.state = Behavon.useMemo(() => ({ value: 0 }), []);
  slots[0] = Behavon.useMemo(() => ({ value: 0 }), []);
  const { state: memberState } = box;
  const [slotState] = slots;
  const wrapper = { input, state, external: externalObject };
  memberState!.value = 1;
  slotState!.value = 1;
  wrapper.input.value = 1;
  wrapper.state.value = 1;
  wrapper.external.value = 1;
  return state.value;
}

export function StoredOperationModel(): undefined {
  const body = Behavon.useCallback(() => undefined, []);
  const box: {
    signal?: () => unknown;
    slot?: () => unknown;
    snapshots?: readonly [unknown, (value: number) => void];
  } = {};
  const slots: Array<(() => unknown) | undefined> = [];
  box.signal = Behavon.useSignal(storedOperationModelPort, "stored.signal", body);
  box.slot = Behavon.useSlot(storedOperationModelPort, "stored.slot", body);
  box.snapshots = Behavon.useSnapshot(storedSnapshot);
  slots[0] = Behavon.useSignal(storedOperationModelPort, "stored.index", body);
  box.signal!();
  box.slot!.call(undefined);
  box.snapshots[1].apply(undefined, [1]);
  slots[0]!.call(undefined);
  return undefined;
}

function invokeOperationParameter(operation: () => unknown): void {
  operation();
}

function invokeOperationParameterCall(operation: () => unknown): void {
  operation.call(undefined);
}

function invokeManagedParameter(callback: () => unknown): void {
  callback();
}

export function HelperCallableProvenanceModel(): undefined {
  const callback = Behavon.useCallback(() => {
    externalCount = 8;
  }, []);
  const signal = Behavon.useSignal(helperCallableProvenanceModelPort, "helper.operation", () => undefined);
  invokeOperationParameter(signal);
  invokeOperationParameterCall(signal);
  invokeManagedParameter(callback);
  return undefined;
}

export function ImpureAliasModel(): number {
  const [epoch] = Behavon.useState(0);
  const now = Date.now;
  let random: () => number;
  random = Math.random;
  const clock = { performanceNow: performance.now };
  const uuid = crypto.randomUUID;
  return epoch + now() + random.call(Math) + clock.performanceNow.apply(performance, []) + uuid.call(crypto).length;
}

function mutateDirectMemberHelper(): void {
  externalCount = 9;
}

function mutateDirectSlotHelper(): void {
  externalCount = 10;
}

const directHelperBox = { run: mutateDirectMemberHelper };
const directHelperSlots = [mutateDirectSlotHelper];

export function DirectStoredHelperModel(): number {
  const [value] = Behavon.useState(0);
  directHelperBox.run();
  directHelperSlots[0]();
  return value;
}

export function DirectStoredManagedCallbackModel(): undefined {
  const [, publish] = Behavon.useSnapshot(storedCallbackSnapshot);
  const signal = Behavon.useSignal(directStoredManagedCallbackModelPort, "stored.callback.signal", () => undefined);
  const publishCallback = Behavon.useCallback(() => {
    publish(1);
  }, [publish]);
  const signalCallback = Behavon.useCallback(() => {
    signal();
  }, [signal]);
  const callbackBox = { run: publishCallback };
  const callbackSlots = [signalCallback];
  callbackBox.run();
  callbackSlots[0]();
  return undefined;
}

function invokeDependencyEndpoint(endpoint: (...args: unknown[]) => unknown): void {
  endpoint("helper");
}

function invokeDependencyProxy(
  dependency: DependencyProxy & Readonly<Record<string, any>>,
  endpointName: string,
): void {
  dependency[endpointName]("helper");
}

export function DependencyEndpointOperationModel(input: {
  readonly dependency: TypedModelRef<any>;
  readonly endpointName: string;
}): undefined {
  const dependency = Behavon.usePort(input.dependency);
  const alias = dependency.alias;
  dependency.direct(1);
  dependency["static"](2);
  dependency[input.endpointName](3);
  alias(4);
  dependency.called.call(undefined, 5);
  dependency.applied.apply(undefined, [6]);
  invokeDependencyEndpoint(dependency.helper);
  invokeDependencyProxy(dependency, input.endpointName);
  return undefined;
}

const transactionEvaluationStates = Behavon.createId({
  value: Behavon.StateType<number>(),
});
const transactionEvaluationId = Behavon.createId();

export function TransactionLifecycleEvaluationModel(): number {
  const [value] = Behavon.useLabelState(transactionEvaluationStates.value, 0);
  Behavon.transaction.start(transactionEvaluationId, [transactionEvaluationStates.value]);
  Behavon.transaction.run(transactionEvaluationId, () => undefined);
  Behavon.transaction.commit(transactionEvaluationId);
  Behavon.transaction.rollback(transactionEvaluationId);
  return value;
}

export function useTransactionLifecycleEvaluation(): undefined {
  transaction.start(transactionEvaluationId, [transactionEvaluationStates.value]);
  transaction.run(transactionEvaluationId, () => undefined);
  transaction.commit(transactionEvaluationId);
  transaction.rollback(transactionEvaluationId);
  return undefined;
}

export function AsyncTransactionRunModel(): undefined {
  const callback = Behavon.useCallback(() => {
    const id = Behavon.createId();
    Behavon.transaction.start(id, [transactionEvaluationStates.value]);
    // @ts-expect-error transaction.run bodies must be synchronous.
    Behavon.transaction.run(id, async () => undefined);
    Behavon.transaction.rollback(id);
  }, []);
  Behavon.useSignal(asyncTransactionRunModelPort, "asyncTransaction", callback);
  return undefined;
}
import type { Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
type MutationModelPortType = { "callback": PortOnlySignal<any> };
const mutationModelPort = Behavon.createPort<MutationModelPortType>({ "callback": Behavon.SignalType() });
type EvaluationOperationModelPortType = { "signal": PortOnlySignal<any> };
const evaluationOperationModelPort = Behavon.createPort<EvaluationOperationModelPortType>({ "signal": Behavon.SignalType() });
type OperationCallApplyModelPortType = { "call.apply": PortOnlySignal<any> };
const operationCallApplyModelPort = Behavon.createPort<OperationCallApplyModelPortType>({ "call.apply": Behavon.SignalType() });
type DeferredImmutableMutationModelPortType = { "deferred.immutable": PortOnlySignal<any> };
const deferredImmutableMutationModelPort = Behavon.createPort<DeferredImmutableMutationModelPortType>({ "deferred.immutable": Behavon.SignalType() });
type StoredOperationModelPortType = { "stored.signal": PortOnlySignal<any>; "stored.slot": PortOnlySlot<any>; "stored.index": PortOnlySignal<any> };
const storedOperationModelPort = Behavon.createPort<StoredOperationModelPortType>({ "stored.signal": Behavon.SignalType(), "stored.slot": Behavon.SlotType(), "stored.index": Behavon.SignalType() });
type HelperCallableProvenanceModelPortType = { "helper.operation": PortOnlySignal<any> };
const helperCallableProvenanceModelPort = Behavon.createPort<HelperCallableProvenanceModelPortType>({ "helper.operation": Behavon.SignalType() });
type DirectStoredManagedCallbackModelPortType = { "stored.callback.signal": PortOnlySignal<any> };
const directStoredManagedCallbackModelPort = Behavon.createPort<DirectStoredManagedCallbackModelPortType>({ "stored.callback.signal": Behavon.SignalType() });
type AsyncTransactionRunModelPortType = { "asyncTransaction": PortOnlySignal<any> };
const asyncTransactionRunModelPort = Behavon.createPort<AsyncTransactionRunModelPortType>({ "asyncTransaction": Behavon.SignalType() });
