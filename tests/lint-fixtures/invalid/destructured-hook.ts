import * as Behavon from "behavon";

export function DestructuredHookModel(): number {
  const { useState } = Behavon;
  return useState(0)[0];
}
