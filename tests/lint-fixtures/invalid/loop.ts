import Behavon from "behavon";

export function LoopModel(values: readonly number[]): undefined {
  for (const value of values) Behavon.useMemo(() => value, [value]);
  return undefined;
}
