import Behavon from "behavon";
import type { ModelInstance, UntypedModelRef } from "behavon";

export function DiscardedSatisfiesModel(
  dependency: UntypedModelRef,
  instance: ModelInstance<undefined, undefined>,
): undefined {
  Behavon.useState(0) satisfies unknown;
  Behavon.useMemo(() => 0, []) satisfies unknown;
  Behavon.useCallback(() => undefined, []) satisfies unknown;
  Behavon.useModel(instance) satisfies unknown;
  Behavon.usePort(dependency) satisfies unknown;
  Behavon.useExport(() => ({ value: 0 })) satisfies unknown;
  return undefined;
}
