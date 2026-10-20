import Behavon from "behavon";

export function OptionalHookModel(): number {
  const [value] = Behavon?.useState(0);
  return value;
}

export function OptionalCallHookModel(): number {
  const [value] = Behavon.useState?.(0);
  return value;
}
