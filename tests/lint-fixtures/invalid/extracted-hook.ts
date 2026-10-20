import * as Behave from "behavon";

export function ExtractedHookModel(): number {
  const stateHook = Behave.useState;
  return stateHook(0)[0];
}
