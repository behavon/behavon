import Behave from "behavon";

export function OptionalHookModel(): number {
  const [value] = Behave?.useState(0);
  return value;
}

export function OptionalCallHookModel(): number {
  const [value] = Behave.useState?.(0);
  return value;
}
