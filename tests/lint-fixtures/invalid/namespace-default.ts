import * as Behave from "behavon";

export function DirectNamespaceDefaultModel(): number {
  const [value] = Behave.default.useState(0);
  return value;
}

export function ComputedNamespaceDefaultModel(): number {
  const [value] = Behave["default"].useState(0);
  return value;
}

const DefaultFacade = Behave.default;
const { default: DestructuredDefault } = Behave;
void DestructuredDefault;

export function AliasedNamespaceDefaultModel(): number {
  const [value] = DefaultFacade.useState(0);
  return value;
}
