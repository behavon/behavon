import Behavon, { useEffect, useReducer, useState } from "behavon";
import type { SnapshotRootId, StateSetter } from "behavon";

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
  const exported = Behavon.useExport(namedHookPort, "identity");
  return exported === undefined ? 0 : value;
}

export function ReducerModel(): number {
  const [value] = useReducer((state: number, action: number) => state + action, 0);
  return value;
}

export function StableExportDependencyModel(): number {
  const exported = Behavon.useExport(stableExportDependencyPort, "value");
  Behavon.useEffect(() => {
    void exported;
  }, []);
  return 1;
}

export function RegistrationOnlyExportModel(): undefined {
  Behavon.useExport(registrationOnlyExportPort, "identity");
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
const namedHookPort = Behavon.createPort<{ identity: SnapshotRootId<string> }>({ identity: Behavon.SnapshotType() });
const stableExportDependencyPort = Behavon.createPort<{ value: SnapshotRootId<number> }>({ value: Behavon.SnapshotType() });
const registrationOnlyExportPort = Behavon.createPort<{ identity: SnapshotRootId<string> }>({ identity: Behavon.SnapshotType() });
