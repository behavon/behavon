import { default as Behavon } from "behavon";

export function DefaultConditionalModel(condition: boolean): number {
  if (condition) {
    const [value] = Behavon.useState(0);
    return value;
  }
  return 0;
}
