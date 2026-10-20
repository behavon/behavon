import { useState as state } from "behavon";

export function BadNamedHookAliasModel(): number {
  return state(0)[0];
}
