import Behavon from "behavon";
import type { Signal, TypedModelRef } from "behavon";

export function NestedConnectUseModel(
  source: Signal,
  destination: TypedModelRef<any>,
): undefined {
  Behavon.useConnect(source, Behavon.usePort(destination).receive);
  return undefined;
}
