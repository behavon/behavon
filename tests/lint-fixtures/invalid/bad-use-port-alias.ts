import { usePort as port } from "behavon";
import type { UntypedModelRef } from "behavon";

export function DependencyModel(dependency: UntypedModelRef): undefined {
  const dependencyProxy = port(dependency);
  void dependencyProxy;
  return undefined;
}
