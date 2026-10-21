import Behavon from "behavon";

const moduleValue = 1;

function useCustomCommand(): () => void {
  return () => undefined;
}

export function MissingDependencyModel(input: { readonly step: number }): number {
  const [count] = Behavon.useState(0);
  const value = Behavon.useMemo(() => count + input.step, []);
  return value;
}

export function DuplicateDependencyModel(input: number): number {
  const value = Behavon.useMemo(() => input, [input, input]);
  return value;
}

export function DynamicDependencyModel(input: number, dependencies: readonly unknown[]): number {
  const value = Behavon.useMemo(() => input, dependencies);
  return value;
}

export function ShadowedUndefinedEffectModel(
  input: number,
  undefined: readonly unknown[],
): undefined {
  Behavon.useEffect(() => void input, undefined);
  return void 0;
}

export function MissingDependencyArrayModel(input: number): readonly [number, () => number] {
  // @ts-expect-error invalid fixture intentionally omits the required useMemo dependency array.
  const value = Behavon.useMemo(() => input);
  // @ts-expect-error invalid fixture intentionally omits the required useCallback dependency array.
  const callback = Behavon.useCallback(() => input);
  return [value, callback];
}

export function ComplexDependencyModel(input: { readonly value: number }): number {
  const value = Behavon.useMemo(() => input.value, [input.value + 1]);
  return value;
}

export function OuterScopeDependencyModel(): number {
  const value = Behavon.useMemo(() => moduleValue, [moduleValue]);
  return value;
}

export function UnnecessaryDependencyModel(input: number): number {
  const value = Behavon.useMemo(() => 1, [input]);
  const callback = Behavon.useCallback(() => undefined, [input]);
  callback();
  return value;
}

export function UnknownCallbackModel(input: number, callback: () => number): number {
  const value = Behavon.useMemo(callback, [input]);
  return value;
}

export function MemberCallbackModel(input: { readonly box: { readonly callback: () => number } }): number {
  const value = Behavon.useMemo(input.box.callback, [input.box.callback]);
  return value;
}

export function WriteOnlyAssignmentModel(): undefined {
  let value = 0;
  Behavon.useEffect(() => {
    value = 1;
  }, []);
  return undefined;
}

export function AliasAndCustomHookModel(input: { readonly user: { readonly id: string } }): undefined {
  const user = input.user;
  const customCommand = useCustomCommand();
  const callback = Behavon.useCallback(() => {
    customCommand();
    void user.id;
  }, []);
  Behavon.useSignal(aliasAndCustomHookModelPort, "callback", callback);
  return undefined;
}

export function WriteOnlyHelperModel(): undefined {
  let value = 0;
  function change(): void {
    value = 1;
  }
  Behavon.useEffect(() => change(), []);
  return undefined;
}

export function ReassignedStableCapabilityModel(input: { readonly replacement: () => void }): undefined {
  let [, setValue] = Behavon.useState(0);
  setValue = input.replacement;
  Behavon.useEffect(() => setValue(1), []);
  return undefined;
}
import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
type AliasAndCustomHookModelPortType = { "callback": PortOnlySignal<any> };
const aliasAndCustomHookModelPort = Behavon.createPort<AliasAndCustomHookModelPortType>({ "callback": Behavon.SignalType() });
