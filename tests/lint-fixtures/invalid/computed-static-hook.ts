import * as Behavon from "behavon";

const stateHook = "useState";
const chainedStateHook = stateHook;
const hookPrefix = "use";
const hookSuffix = "State";

export function StaticComputedHookModel(): undefined {
  Behavon[stateHook](0);
  // @ts-expect-error TypeScript does not fold string concatenation to a namespace key.
  Behavon["use" + "State"](0);
  Behavon[`${hookPrefix}${hookSuffix}` as "useState"](0);
  Behavon[chainedStateHook](0);
  return undefined;
}
