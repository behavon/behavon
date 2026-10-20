import { default as Behave } from "behavon";

export function DefaultConditionalModel(condition: boolean): number {
  if (condition) {
    const [value] = Behave.useState(0);
    return value;
  }
  return 0;
}
