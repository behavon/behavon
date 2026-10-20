import Behave from "behavon";
import type { Signal, UntypedModelRef } from "behavon";

export function NestedConnectUseModel(
  source: Signal,
  destination: UntypedModelRef,
): undefined {
  Behave.useConnect(source, Behave.usePort(destination).receive);
  return undefined;
}
