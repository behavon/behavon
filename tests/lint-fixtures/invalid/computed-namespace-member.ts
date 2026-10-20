import * as Behave from "behavon";
import { externalBehaveKey } from "../support/computed-namespace-key.js";

export function readParameterMember(key: keyof typeof Behave): string {
  return typeof Behave[key];
}

export function readMutableMember(): string {
  let key: keyof typeof Behave = "useState";
  key = Math.random() > 0.5 ? "useModel" : key;
  return typeof Behave[key];
}

export function readExternalMember(): string {
  return typeof Behave[externalBehaveKey];
}

export function readConditionalMember(condition: boolean): string {
  const key = condition ? "useState" : "createModel";
  return typeof Behave[key];
}

export function readUnionMember(key: "useState" | "useModel"): string {
  return typeof Behave[key];
}

export function readKnownNonHookMember(): string {
  return typeof Behave["createModel"];
}
