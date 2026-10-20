import Behavon from "behavon";

export function TryCatchModel(): undefined {
  try {
    Behavon.useState(0);
  } catch {
    return undefined;
  }
  return undefined;
}
