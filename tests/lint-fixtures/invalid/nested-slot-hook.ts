import Behave from "behavon";

export function NestedSlotHookModel(): undefined {
  Behave.useSlot("event", Behave.useCallback(() => undefined, []));
  return undefined;
}
