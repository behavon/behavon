import * as Behave from "behavon";

export function DestructuredHookModel(): number {
  const { useState } = Behave;
  return useState(0)[0];
}
