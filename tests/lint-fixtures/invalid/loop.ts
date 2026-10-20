import Behave from "behavon";

export function LoopModel(values: readonly number[]): undefined {
  for (const value of values) Behave.useMemo(() => value, [value]);
  return undefined;
}
