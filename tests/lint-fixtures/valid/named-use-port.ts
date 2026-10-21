import { usePort as useDependencyPort } from "behavon";
import type { DependencyProxy, TypedModelRef } from "behavon";

export function DependencyModel(dependency: TypedModelRef<any>): DependencyProxy {
  const dependencyProxy = useDependencyPort(dependency);
  return dependencyProxy;
}
