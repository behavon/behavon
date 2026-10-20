import Behavon from "behavon";

export function NestedSignalHookModel(): undefined {
  Behavon.useSignal("event", Behavon.useCallback(() => undefined, []));
  return undefined;
}
