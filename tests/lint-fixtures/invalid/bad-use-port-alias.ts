import { usePort as port } from "behavon";
import type { TypedModelRef } from "behavon";

export function DependencyModel(dependency: TypedModelRef<any>): undefined {
  const dependencyProxy = port(dependency);
  void dependencyProxy;
  return undefined;
}
