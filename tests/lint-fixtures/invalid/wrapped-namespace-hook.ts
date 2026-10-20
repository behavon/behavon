import * as Behavon from "behavon";

export function WrappedNamespaceHookModel(): number {
  const [state] = (Behavon as typeof Behavon).useState(0);
  const memo = Behavon!.useMemo(() => state, [state]);
  const callback = (Behavon as typeof Behavon)["useCallback"](() => memo, [memo]);
  return callback();
}
