import Behavon, { useEffect, useReducer, useState } from "behavon";
import type { StateSetter } from "behavon";

export type BehavonFacadeType = typeof Behavon;

function useCounter(): readonly [number, StateSetter<number>] {
  const state = Behavon.useState(0);
  return state;
}

export function CounterModel(): number {
  const [count] = useCounter();
  const doubled = Behavon.useMemo(() => count * 2, [count]) satisfies number;
  useEffect(() => undefined, []) satisfies unknown;
  return doubled;
}

export function NamedHookModel(): number {
  const [value] = useState(1);
  const exported = Behavon.useExport(() => ({ identity: "named" as const }));
  return exported.identity === "named" ? value : 0;
}

export function ReducerModel(): number {
  const [value] = useReducer((state: number, action: number) => state + action, 0);
  return value;
}

export function StableExportDependencyModel(): number {
  const exported = Behavon.useExport(() => ({ value: 1 as const }));
  Behavon.useEffect(() => {
    void exported.value;
  }, []);
  return exported.value;
}

export function RegistrationOnlyExportModel(): undefined {
  Behavon.useExport(() => ({ identity: "public" as const }));
  return undefined;
}

export function runNonHookUtility(Behavon: { useful: () => void }): void {
  try {
    Behavon.useful();
  } catch {
    // A non-Hook member is not part of the Behavon Hook authoring contract.
  }
}

export function readDirectNonHookMember(): string {
  return typeof Behavon.createModel;
}

export function callBindinglessComputedMember(): number {
  const key = "useState";
  const Behavon = { useState: (value: number) => value };
  return Behavon[key](0);
}
