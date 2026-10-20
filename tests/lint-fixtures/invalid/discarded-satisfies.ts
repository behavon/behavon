import Behave from "behavon";
import type { ModelInstance, UntypedModelRef } from "behavon";

export function DiscardedSatisfiesModel(
  dependency: UntypedModelRef,
  instance: ModelInstance<undefined, undefined>,
): undefined {
  Behave.useState(0) satisfies unknown;
  Behave.useMemo(() => 0, []) satisfies unknown;
  Behave.useCallback(() => undefined, []) satisfies unknown;
  Behave.useModel(instance) satisfies unknown;
  Behave.usePort(dependency) satisfies unknown;
  Behave.useExport(() => ({ value: 0 })) satisfies unknown;
  return undefined;
}
