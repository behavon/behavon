import * as ModelEngine from "behavon";

export function NamespaceAliasModel(): number {
  return ModelEngine.useState(0)[0];
}
