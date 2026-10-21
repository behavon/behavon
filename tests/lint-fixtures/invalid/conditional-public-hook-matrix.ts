import Behavon, { type ModelInstance } from "behavon"; const conditionalSnapshot = Behavon.createId(Behavon.SnapshotType<unknown>()); const conditionalState = Behavon.createId({ value: Behavon.StateType<number>() }); const conditionalResource = Behavon.createResource({ open: () => ({}), close: () => undefined, abort: () => undefined });

export function ConditionalPublicHookMatrix(enabled: boolean, model: ModelInstance): undefined {
  if (enabled) Behavon.useState(0);
  if (enabled) Behavon.useMemo(() => 0, []);
  if (enabled) Behavon.useCallback(() => undefined, []);
  if (enabled) Behavon.useEffect(() => undefined, []);
  if (enabled) Behavon.useSyncExternalStore(() => () => undefined, () => 0);
  if (enabled) Behavon.useSignal(conditionalPublicHookMatrixPort, "signal", () => undefined);
  if (enabled) Behavon.useSlot(conditionalPublicHookMatrixPort, "slot", () => undefined);
  if (enabled) Behavon.useModel(model);
  if (enabled) {
    const dependency = Behavon.usePort(undefined as never);
    void dependency;
  }
  if (enabled) Behavon.useConnect(undefined as never, undefined as never);
  if (enabled) Behavon.useSnapshot(conditionalSnapshot);
  if (enabled) Behavon.useMutable(0);
  if (enabled) Behavon.useExport(conditionalPublicHookMatrixPort, "value");
  if (enabled) {
    const labeled = Behavon.useLabelState(conditionalState.value, 0);
    void labeled;
  }
  if (enabled) {
    const reduced = Behavon.useReducer((state: number) => state, 0);
    void reduced;
  }
  if (enabled) {
    const resource = Behavon.useResource(conditionalResource, undefined);
    void resource;
  }
  if (enabled) {
    const future = Behavon.useFuture(async () => undefined, { concurrency: "serial" });
    future.snapshot();
  }
  return undefined;
}
import type { Signal as PortOnlySignal, Slot as PortOnlySlot, SnapshotRootId } from "behavon";
type ConditionalPublicHookMatrixPortType = { "signal": PortOnlySignal<any>; "slot": PortOnlySlot<any>; "value": SnapshotRootId<number> };
const conditionalPublicHookMatrixPort = Behavon.createPort<ConditionalPublicHookMatrixPortType>({ "signal": Behavon.SignalType(), "slot": Behavon.SlotType(), "value": Behavon.SnapshotType() });
