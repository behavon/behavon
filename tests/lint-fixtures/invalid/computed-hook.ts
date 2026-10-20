import * as Behavon from "behavon";

export function ComputedHookModel(): number {
  return Behavon["useState"](0)[0];
}
