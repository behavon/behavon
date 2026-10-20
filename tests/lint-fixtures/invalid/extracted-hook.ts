import * as Behavon from "behavon";

export function ExtractedHookModel(): number {
  const stateHook = Behavon.useState;
  return stateHook(0)[0];
}
