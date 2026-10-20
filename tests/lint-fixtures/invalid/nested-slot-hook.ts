import Behavon from "behavon";

export function NestedSlotHookModel(): undefined {
  Behavon.useSlot("event", Behavon.useCallback(() => undefined, []));
  return undefined;
}
