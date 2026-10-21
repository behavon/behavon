import Behavon, { transaction } from "behavon";
import type { TypedModelRef } from "behavon";

const externalTrace: number[] = [];
const externalPrimitive = 1;
const deferredSnapshot = Behavon.createId(Behavon.SnapshotType<number>());
const deferredTransactionStates = Behavon.createId({
  value: Behavon.StateType<number>(),
});

export function MutableDuringEvaluationModel(input: number): number {
  const mutable = Behavon.useMutable(input);
  mutable.set(current => current + 1);
  return mutable.get();
}

export function DeferredTransactionModel(): number {
  const [value, setValue] = Behavon.useLabelState(deferredTransactionStates.value, 0);
  const execute = Behavon.useCallback(() => {
    const id = Behavon.createId();
    Behavon.transaction.start(id, [deferredTransactionStates.value]);
    transaction.run(id, () => setValue((previous) => previous + 1));
    transaction.commit(id);
  }, [setValue]);
  Behavon.useSignal(deferredTransactionModelPort, "transaction", execute);
  return value;
}

export function LocalMutationModel(input: { readonly value: number }): number {
  const values = [input.value];
  const draft = { value: input.value };
  values.push(input.value + 1);
  draft.value += 1;
  return values[1] + draft.value;
}

export function DeferredOperationModel(input: {
  readonly dependency: TypedModelRef<any>;
  readonly object: { value: number };
}): undefined {
  const dependency = Behavon.usePort(input.dependency);
  const [state] = Behavon.useState({ value: 0 });
  let local = externalPrimitive;
  local += 1;
  let rebound = input.object;
  rebound = { value: local };
  rebound.value += 1;
  const values: number[] = [];
  const map = new Map<string, number>();
  const set = new Set<number>();
  values.push(rebound.value);
  values.sort();
  map.set("value", rebound.value);
  map.delete("missing");
  set.add(rebound.value);
  set.delete(-1);
  const callback = Behavon.useCallback(() => {
    externalTrace.push(state.value);
    dependency.set(state.value);
  }, [dependency, state]);
  let reboundEndpoint = dependency.set;
  reboundEndpoint = () => undefined;
  reboundEndpoint();
  const boundEndpoint = dependency.set.bind(undefined);
  Behavon.useEffect(() => {
    externalTrace.push(state.value);
    const endpoint = dependency.push;
    dependency.set(state.value);
    dependency["sort"]();
    dependency[input.object.value === 0 ? "delete" : "clear"]("value");
    endpoint.call(undefined, state.value);
    dependency.delete.apply(undefined, ["value"]);
    boundEndpoint(state.value);
  }, [boundEndpoint, dependency, input, state]);
  Behavon.useSignal(deferredOperationModelPort, "run", callback);
  return undefined;
}

export function ShadowedGlobalsModel(): number {
  const Date = { now: () => 1 };
  const Math = { random: () => 2 };
  const Array = () => ({ push: (_value: number) => undefined });
  Array().push(1);
  return Date.now() + Math.random();
}

export function ReboundImmutableModel(input: { value: number }): number {
  let state: { value: number };
  [state] = Behavon.useState({ value: 0 });
  state = { value: input.value };
  state.value += 1;
  input = { value: state.value };
  input.value += 1;
  let callback = Behavon.useCallback(() => externalTrace.push(state.value), [state]);
  callback = () => input.value;
  callback();
  return input.value;
}

const externalCommand = {
  push(_value: number): void {},
  set(_key: string, _value: number): void {},
};

function mutateLocalDraft(value: { count: number }): void {
  value.count += 1;
}

function PascalCaseHelper(): void {
  externalTrace[0] = 0;
}

function usefullyNamedHelper(): void {
  externalTrace[0] = 0;
}

export function CommandAndLocalHelperModel(input: {
  command: { push(value: number): void; set(key: string, value: number): void };
}): number {
  const command = Behavon.useMemo(() => ({
    push(_value: number): void {},
    set(_key: string, _value: number): void {},
  }), []);
  externalCommand.push(1);
  externalCommand.set("external", 1);
  input.command.push(1);
  input.command.set("input", 1);
  command.push(1);
  command.set("memo", 1);
  const draft = { count: 0 };
  mutateLocalDraft(draft);
  return draft.count;
}

export function DeferredCallOperationModel(): undefined {
  const [, publish] = Behavon.useSnapshot(deferredSnapshot);
  const body = Behavon.useCallback(() => undefined, []);
  const signal = Behavon.useSignal(deferredCallOperationModelPort, "deferred.call", body);
  Behavon.useEffect(() => {
    publish.call(undefined, 1);
    signal.apply(undefined, []);
    Object.assign(externalCommand, { untouched: true });
  }, [publish, signal]);
  return undefined;
}

export function ReboundMemberHookResultModel(): number {
  const box: { state?: { value: number } } = {};
  box.state = Behavon.useMemo(() => ({ value: 0 }), []);
  box.state = { value: 1 };
  box.state.value += 1;
  return box.state.value;
}

void PascalCaseHelper;
void usefullyNamedHelper;

function originalImpureHelper(): void {
  externalTrace[0] = 1;
}

function replacementPureHelper(): number {
  return 1;
}

let latestHelper = originalImpureHelper;
latestHelper = replacementPureHelper;

const latestHelperBox = { run: originalImpureHelper as () => unknown };
latestHelperBox.run = replacementPureHelper;

function OriginalImpureModel(): number {
  externalTrace[0] = 2;
  return 0;
}

function ReplacementPureModel(): number {
  return 1;
}

let latestModel: typeof OriginalImpureModel = OriginalImpureModel;
latestModel = ReplacementPureModel;
export const reboundModelInstance = Behavon.createModel(latestModel, undefined);

interface CommandShape {
  push(value: number): void;
  set(key: string, value: number): void;
}

type ArrayOrCommand = number[] | CommandShape;
type MapOrCommand = Map<string, number> | CommandShape;

export function AlternateShapeControlModel({
  command,
  arrayOrCommand,
  mapOrCommand,
}: {
  command: CommandShape;
  arrayOrCommand: ArrayOrCommand;
  mapOrCommand: MapOrCommand;
}): number {
  const [value] = Behavon.useState(0);
  command.push(value);
  command.set("value", value);
  arrayOrCommand.push(value);
  mapOrCommand.set("value", value);
  latestHelper();
  latestHelperBox.run();
  return value;
}

export function ContainerRebindControlModel(input: { value: number }): number {
  const wrapper = { current: input };
  wrapper.current = { value: 1 };
  wrapper.current.value += 1;
  let { current } = { current: input };
  current = { value: wrapper.current.value };
  current.value += 1;
  return current.value;
}

function invokeDeferredOperation(operation: () => unknown): void {
  operation.call(undefined);
}

function invokeDeferredCallback(callback: () => unknown): void {
  callback();
}

function invokeReboundOperation(operation: () => unknown): void {
  operation = () => undefined;
  operation();
}

export function AlternateOperationControlModel(): undefined {
  const body = Behavon.useCallback(() => undefined, []);
  const signal = Behavon.useSignal(alternateOperationControlModelPort, "alternate.control", body);
  const box: { signal?: () => unknown } = {};
  box.signal = signal;
  const originalCallback = Behavon.useCallback(() => {
    externalTrace[0] = 3;
  }, []);
  const callbackBox: { callback: () => unknown } = { callback: originalCallback };
  const callbackSlots: Array<() => unknown> = [originalCallback];
  callbackBox.callback = () => undefined;
  callbackSlots[0] = () => undefined;
  callbackBox.callback();
  callbackSlots[0]();
  Behavon.useEffect(() => {
    box.signal!();
    box.signal!.call(undefined);
    invokeDeferredOperation(signal);
    invokeDeferredCallback(body);
  }, [body, box.signal, signal]);
  invokeReboundOperation(signal);
  return undefined;
}

export function ImpureAliasRebindControlModel(): number {
  let now: () => number = Date.now;
  now = () => 1;
  const localClock = { now: () => 2 };
  return now.call(undefined) + localClock.now.apply(undefined, []);
}
import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
type DeferredTransactionModelPortType = { "transaction": PortOnlySignal<any> };
const deferredTransactionModelPort = Behavon.createPort<DeferredTransactionModelPortType>({ "transaction": Behavon.SignalType() });
type DeferredOperationModelPortType = { "run": PortOnlySignal<any> };
const deferredOperationModelPort = Behavon.createPort<DeferredOperationModelPortType>({ "run": Behavon.SignalType() });
type DeferredCallOperationModelPortType = { "deferred.call": PortOnlySignal<any> };
const deferredCallOperationModelPort = Behavon.createPort<DeferredCallOperationModelPortType>({ "deferred.call": Behavon.SignalType() });
type AlternateOperationControlModelPortType = { "alternate.control": PortOnlySignal<any> };
const alternateOperationControlModelPort = Behavon.createPort<AlternateOperationControlModelPortType>({ "alternate.control": Behavon.SignalType() });
