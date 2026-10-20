import Behavon from "behavon";

export function EarlyReturnModel(enabled: boolean): undefined {
  if (!enabled) return undefined;
  Behavon.useState(0);
  return undefined;
}
