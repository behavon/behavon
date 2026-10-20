import Behave from "behavon";

export function EarlyReturnModel(enabled: boolean): undefined {
  if (!enabled) return undefined;
  Behave.useState(0);
  return undefined;
}
