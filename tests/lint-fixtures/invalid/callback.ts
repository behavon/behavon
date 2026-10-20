import Behave from "behavon";

export function CallbackModel(values: readonly number[]): undefined {
  values.forEach(() => Behave.useState(0));
  return undefined;
}
