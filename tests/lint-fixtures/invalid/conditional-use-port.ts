import Behavon from "behavon";
import type { UntypedModelRef } from "behavon";

export function ConditionalDependencyModel(dependency: UntypedModelRef, enabled: boolean): undefined {
  if (enabled) {
    const dependencyProxy = Behavon.usePort(dependency);
    void dependencyProxy;
  }
  return undefined;
}
