import * as Behave from "behavon";

export function NamespaceCompatibilityModel(): number {
  const [value] = Behave.useState(0);
  const doubled = Behave.useMemo(() => value * 2, [value]);
  return doubled;
}
