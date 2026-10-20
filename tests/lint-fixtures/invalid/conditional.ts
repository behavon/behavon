import Behave from "behavon";

export function ConditionalModel(enabled: boolean): undefined {
  if (enabled) Behave.useState(0);
  return undefined;
}
