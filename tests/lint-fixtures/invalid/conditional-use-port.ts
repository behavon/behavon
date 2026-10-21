import Behavon from "behavon";
import type { TypedModelRef } from "behavon";

export function ConditionalDependencyModel(dependency: TypedModelRef<any>, enabled: boolean): undefined {
  if (enabled) {
    const dependencyProxy = Behavon.usePort(dependency);
    void dependencyProxy;
  }
  return undefined;
}
