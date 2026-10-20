import Behavon from "behavon";

export function ConditionalModel(enabled: boolean): undefined {
  if (enabled) Behavon.useState(0);
  return undefined;
}
