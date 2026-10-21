import Behavon from "behavon";
import type { ModelInstance, TypedModelRef } from "behavon";

export function DiscardedSatisfiesModel(
  dependency: TypedModelRef<any>,
  instance: ModelInstance<undefined, undefined>,
): undefined {
  Behavon.useState(0) satisfies unknown;
  Behavon.useMemo(() => 0, []) satisfies unknown;
  Behavon.useCallback(() => undefined, []) satisfies unknown;
  Behavon.useModel(instance) satisfies unknown;
  Behavon.usePort(dependency) satisfies unknown;
  Behavon.useExport(discardedSatisfiesPort, "value") satisfies unknown;
  return undefined;
}
const discardedSatisfiesPort = Behavon.createPort<{ value: SnapshotRootId<number> }>({ value: Behavon.SnapshotType() });
import type { SnapshotRootId } from "behavon";
