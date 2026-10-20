import Behave, { type ModelInstance } from "behavon"; const conditionalSnapshot = Behave.createId(Behave.SnapshotType<unknown>()); const conditionalState = Behave.createId({ value: Behave.StateType<number>() }); const conditionalResource = Behave.createResource({ open: () => ({}), close: () => undefined, abort: () => undefined });

export function ConditionalPublicHookMatrix(enabled: boolean, model: ModelInstance): undefined {
  if (enabled) Behave.useState(0);
  if (enabled) Behave.useMemo(() => 0, []);
  if (enabled) Behave.useCallback(() => undefined, []);
  if (enabled) Behave.useEffect(() => undefined, []);
  if (enabled) Behave.useSyncExternalStore(() => () => undefined, () => 0);
  if (enabled) Behave.useSignal("signal", () => undefined);
  if (enabled) Behave.useSlot("slot", () => undefined);
  if (enabled) Behave.useModel(model);
  if (enabled) {
    const dependency = Behave.usePort(undefined as never);
    void dependency;
  }
  if (enabled) Behave.useConnect(undefined as never, undefined as never);
  if (enabled) Behave.useSnapshot(conditionalSnapshot);
  if (enabled) Behave.useMutable(0);
  if (enabled) Behave.useExport(() => ({ value: 0 }));
  if (enabled) {
    const labeled = Behave.useLabelState(conditionalState.value, 0);
    void labeled;
  }
  if (enabled) {
    const reduced = Behave.useReducer((state: number) => state, 0);
    void reduced;
  }
  if (enabled) {
    const resource = Behave.useResource(conditionalResource, undefined);
    void resource;
  }
  if (enabled) {
    const future = Behave.useFuture(async () => undefined, { concurrency: "serial" });
    future.snapshot();
  }
  return undefined;
}
