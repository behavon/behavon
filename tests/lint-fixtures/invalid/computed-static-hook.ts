import * as Behave from "behavon";

const stateHook = "useState";
const chainedStateHook = stateHook;
const hookPrefix = "use";
const hookSuffix = "State";

export function StaticComputedHookModel(): undefined {
  Behave[stateHook](0);
  // @ts-expect-error TypeScript does not fold string concatenation to a namespace key.
  Behave["use" + "State"](0);
  Behave[`${hookPrefix}${hookSuffix}` as "useState"](0);
  Behave[chainedStateHook](0);
  return undefined;
}
