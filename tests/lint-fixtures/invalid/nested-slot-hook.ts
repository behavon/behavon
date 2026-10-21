import Behavon from "behavon";

export function NestedSlotHookModel(): undefined {
  Behavon.useSlot(nestedSlotHookModelPort, "event", Behavon.useCallback(() => undefined, []));
  return undefined;
}
import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
type NestedSlotHookModelPortType = { "event": PortOnlySlot<any> };
const nestedSlotHookModelPort = Behavon.createPort<NestedSlotHookModelPortType>({ "event": Behavon.SlotType() });
