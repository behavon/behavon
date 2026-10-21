import Behavon from "behavon";
import type { ModelInstance, TypedModelRef } from "behavon";

let assignedDependency: unknown;

export function DiscardedValueModel(
  dependency: TypedModelRef<any>,
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
  Behavon.useExport(discardedValuePort, "value");
  return undefined;
}

void assignedDependency;
const discardedValuePort = Behavon.createPort<{ value: SnapshotRootId<number> }>({ value: Behavon.SnapshotType() });
import type { SnapshotRootId } from "behavon";
