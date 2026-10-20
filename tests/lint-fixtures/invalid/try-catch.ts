import Behave from "behavon";

export function TryCatchModel(): undefined {
  try {
    Behave.useState(0);
  } catch {
    return undefined;
  }
  return undefined;
}
