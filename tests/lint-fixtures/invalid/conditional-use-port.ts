import Behave from "behavon";
import type { UntypedModelRef } from "behavon";

export function ConditionalDependencyModel(dependency: UntypedModelRef, enabled: boolean): undefined {
  if (enabled) {
    const dependencyProxy = Behave.usePort(dependency);
    void dependencyProxy;
  }
  return undefined;
}
