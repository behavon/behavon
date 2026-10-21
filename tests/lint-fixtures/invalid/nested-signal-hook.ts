import Behavon from "behavon";

export function NestedSignalHookModel(): undefined {
  Behavon.useSignal(nestedSignalHookModelPort, "event", Behavon.useCallback(() => undefined, []));
  return undefined;
}
import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
type NestedSignalHookModelPortType = { "event": PortOnlySignal<any> };
const nestedSignalHookModelPort = Behavon.createPort<NestedSignalHookModelPortType>({ "event": Behavon.SignalType() });
