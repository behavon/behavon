import * as Behavon from "behavon";

export function NamespaceCompatibilityModel(): number {
  const [value] = Behavon.useState(0);
  const doubled = Behavon.useMemo(() => value * 2, [value]);
  return doubled;
}
