import Behave from "behavon";
import type { ModelInstance, UntypedModelRef } from "behavon";

let assignedDependency: unknown;

export function DiscardedValueModel(
  dependency: UntypedModelRef,
  instance: ModelInstance<undefined, undefined>,
): undefined {
  Behave.usePort(dependency);
  Behave.useState(0);
  Behave.useMemo(() => 0, []);
  Behave.useCallback(() => undefined, []);
  Behave.useModel(instance);
  const unusedDependency = Behave.usePort(dependency);
  const voidDependency = Behave.usePort(dependency);
  void voidDependency;
  const voidMemberDependency = Behave.usePort(dependency);
  void voidMemberDependency.fire;
  const bareReadDependency = Behave.usePort(dependency);
  bareReadDependency;
  const {} = Behave.usePort(dependency);
  assignedDependency = Behave.usePort(dependency);
  Behave.useExport(() => ({ value: 0 }));
  return undefined;
}

void assignedDependency;
