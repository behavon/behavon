import Behave from "behavon";

export function lowercaseModel(): number {
  return Behave.useState(0)[0];
}
