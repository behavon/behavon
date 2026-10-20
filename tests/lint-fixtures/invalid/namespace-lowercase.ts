import * as behavon from "behavon";

export function NamespaceLowercaseModel(): number {
  return behavon.useState(0)[0];
}
