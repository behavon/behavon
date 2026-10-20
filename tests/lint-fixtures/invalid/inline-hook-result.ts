import Behave from "behavon";
import type { UntypedModelRef } from "behavon";

const collected: unknown[] = [];

function consume(_value: unknown): void {}

export function InlineHookResultModel(dependency: UntypedModelRef): undefined {
  const state = Behave.useState(0)[0];
  const endpoint = Behave.usePort(dependency).fire;
  collected.push(Behave.useMemo(() => state, [state]));
  consume(Behave.useCallback(() => endpoint, [endpoint]));
  return undefined;
}
