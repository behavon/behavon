import Behavon from "behavon";
import type { TypedModelRef } from "behavon";

const collected: unknown[] = [];

function consume(_value: unknown): void {}

export function InlineHookResultModel(dependency: TypedModelRef<any>): undefined {
  const state = Behavon.useState(0)[0];
  const endpoint = Behavon.usePort(dependency).fire;
  collected.push(Behavon.useMemo(() => state, [state]));
  consume(Behavon.useCallback(() => endpoint, [endpoint]));
  return undefined;
}
