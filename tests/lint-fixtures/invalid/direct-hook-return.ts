import Behave from "behavon";
import { useState as useNamedState } from "behavon";
import type { UntypedModelRef } from "behavon";

export function DirectDependencyModel(dependency: UntypedModelRef) {
  return Behave.usePort(dependency);
}

export const ConciseStateModel = (): number => Behave.useState(0)[0];

export function NamedStateModel(): number {
  return useNamedState(1)[0];
}
