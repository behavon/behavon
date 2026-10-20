import * as Behave from "behavon";

export function ComputedHookModel(): number {
  return Behave["useState"](0)[0];
}
