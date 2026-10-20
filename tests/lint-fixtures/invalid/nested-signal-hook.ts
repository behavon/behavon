import Behave from "behavon";

export function NestedSignalHookModel(): undefined {
  Behave.useSignal("event", Behave.useCallback(() => undefined, []));
  return undefined;
}
