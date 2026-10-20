import * as Behavon from "behavon";

export function DirectNamespaceDefaultModel(): number {
  const [value] = Behavon.default.useState(0);
  return value;
}

export function ComputedNamespaceDefaultModel(): number {
  const [value] = Behavon["default"].useState(0);
  return value;
}

const DefaultFacade = Behavon.default;
const { default: DestructuredDefault } = Behavon;
void DestructuredDefault;

export function AliasedNamespaceDefaultModel(): number {
  const [value] = DefaultFacade.useState(0);
  return value;
}
