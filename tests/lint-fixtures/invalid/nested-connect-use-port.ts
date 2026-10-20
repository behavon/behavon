import Behavon from "behavon";
import type { Signal, UntypedModelRef } from "behavon";

export function NestedConnectUseModel(
  source: Signal,
  destination: UntypedModelRef,
): undefined {
  Behavon.useConnect(source, Behavon.usePort(destination).receive);
  return undefined;
}
