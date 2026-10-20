import * as behave from "behavon";

export function NamespaceLowercaseModel(): number {
  return behave.useState(0)[0];
}
