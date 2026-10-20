import { usePort as useDependencyPort } from "behavon";
import type { DependencyProxy, UntypedModelRef } from "behavon";

export function DependencyModel(dependency: UntypedModelRef): DependencyProxy {
  const dependencyProxy = useDependencyPort(dependency);
  return dependencyProxy;
}
