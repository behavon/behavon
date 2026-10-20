import Behavon from "behavon";
import type { ModelInstance, UntypedModelRef } from "behavon";

let assignedDependency: unknown;

export function DiscardedValueModel(
  dependency: UntypedModelRef,
  instance: ModelInstance<undefined, undefined>,
): undefined {
  Behavon.usePort(dependency);
  Behavon.useState(0);
  Behavon.useMemo(() => 0, []);
  Behavon.useCallback(() => undefined, []);
  Behavon.useModel(instance);
  const unusedDependency = Behavon.usePort(dependency);
  const voidDependency = Behavon.usePort(dependency);
  void voidDependency;
  const voidMemberDependency = Behavon.usePort(dependency);
  void voidMemberDependency.fire;
  const bareReadDependency = Behavon.usePort(dependency);
  bareReadDependency;
  const {} = Behavon.usePort(dependency);
  assignedDependency = Behavon.usePort(dependency);
  Behavon.useExport(() => ({ value: 0 }));
  return undefined;
}

void assignedDependency;
