import Behavon from "behavon";
import { useState as useNamedState } from "behavon";
import type { TypedModelRef } from "behavon";

export function DirectDependencyModel(dependency: TypedModelRef<any>) {
  return Behavon.usePort(dependency);
}

export const ConciseStateModel = (): number => Behavon.useState(0)[0];

export function NamedStateModel(): number {
  return useNamedState(1)[0];
}
