import Behave, { useEffect, useReducer, useState } from "behavon";
import type { StateSetter } from "behavon";

export type BehaveFacadeType = typeof Behave;

function useCounter(): readonly [number, StateSetter<number>] {
  const state = Behave.useState(0);
  return state;
}

export function CounterModel(): number {
  const [count] = useCounter();
  const doubled = Behave.useMemo(() => count * 2, [count]) satisfies number;
  useEffect(() => undefined, []) satisfies unknown;
  return doubled;
}

export function NamedHookModel(): number {
  const [value] = useState(1);
  const exported = Behave.useExport(() => ({ identity: "named" as const }));
  return exported.identity === "named" ? value : 0;
}

export function ReducerModel(): number {
  const [value] = useReducer((state: number, action: number) => state + action, 0);
  return value;
}

export function StableExportDependencyModel(): number {
  const exported = Behave.useExport(() => ({ value: 1 as const }));
  Behave.useEffect(() => {
    void exported.value;
  }, []);
  return exported.value;
}

export function RegistrationOnlyExportModel(): undefined {
  Behave.useExport(() => ({ identity: "public" as const }));
  return undefined;
}

export function runNonHookUtility(Behave: { useful: () => void }): void {
  try {
    Behave.useful();
  } catch {
    // A non-Hook member is not part of the Behave Hook authoring contract.
  }
}

export function readDirectNonHookMember(): string {
  return typeof Behave.createModel;
}

export function callBindinglessComputedMember(): number {
  const key = "useState";
  const Behave = { useState: (value: number) => value };
  return Behave[key](0);
}
