import * as Behave from "behavon";

export function WrappedNamespaceHookModel(): number {
  const [state] = (Behave as typeof Behave).useState(0);
  const memo = Behave!.useMemo(() => state, [state]);
  const callback = (Behave as typeof Behave)["useCallback"](() => memo, [memo]);
  return callback();
}
