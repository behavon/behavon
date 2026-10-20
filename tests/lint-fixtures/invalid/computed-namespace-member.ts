import * as Behavon from "behavon";
import { externalBehavonKey } from "../support/computed-namespace-key.js";

export function readParameterMember(key: keyof typeof Behavon): string {
  return typeof Behavon[key];
}

export function readMutableMember(): string {
  let key: keyof typeof Behavon = "useState";
  key = Math.random() > 0.5 ? "useModel" : key;
  return typeof Behavon[key];
}

export function readExternalMember(): string {
  return typeof Behavon[externalBehavonKey];
}

export function readConditionalMember(condition: boolean): string {
  const key = condition ? "useState" : "createModel";
  return typeof Behavon[key];
}

export function readUnionMember(key: "useState" | "useModel"): string {
  return typeof Behavon[key];
}

export function readKnownNonHookMember(): string {
  return typeof Behavon["createModel"];
}
