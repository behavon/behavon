import Behavon from "behavon";
import { useState as useNamedState } from "behavon";
import type { UntypedModelRef } from "behavon";

export function DirectDependencyModel(dependency: UntypedModelRef) {
  return Behavon.usePort(dependency);
}

export const ConciseStateModel = (): number => Behavon.useState(0)[0];

export function NamedStateModel(): number {
  return useNamedState(1)[0];
}
