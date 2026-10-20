import Behavon from "behavon";

export function CallbackModel(values: readonly number[]): undefined {
  values.forEach(() => Behavon.useState(0));
  return undefined;
}
