import Behavon from "behavon";

export function lowercaseModel(): number {
  return Behavon.useState(0)[0];
}
