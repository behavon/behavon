import Behave from "behavon";

const moduleValue = 1;

function useCustomCommand(): () => void {
  return () => undefined;
}

export function MissingDependencyModel(input: { readonly step: number }): number {
  const [count] = Behave.useState(0);
  const value = Behave.useMemo(() => count + input.step, []);
  return value;
}

export function DuplicateDependencyModel(input: number): number {
  const value = Behave.useMemo(() => input, [input, input]);
  return value;
}

export function DynamicDependencyModel(input: number, dependencies: readonly unknown[]): number {
  const value = Behave.useMemo(() => input, dependencies);
  return value;
}

export function ShadowedUndefinedEffectModel(
  input: number,
  undefined: readonly unknown[],
): undefined {
  Behave.useEffect(() => void input, undefined);
  return void 0;
}

export function MissingDependencyArrayModel(input: number): readonly [number, () => number] {
  // @ts-expect-error invalid fixture intentionally omits the required useMemo dependency array.
  const value = Behave.useMemo(() => input);
  // @ts-expect-error invalid fixture intentionally omits the required useCallback dependency array.
  const callback = Behave.useCallback(() => input);
  return [value, callback];
}

export function ComplexDependencyModel(input: { readonly value: number }): number {
  const value = Behave.useMemo(() => input.value, [input.value + 1]);
  return value;
}

export function OuterScopeDependencyModel(): number {
  const value = Behave.useMemo(() => moduleValue, [moduleValue]);
  return value;
}

export function UnnecessaryDependencyModel(input: number): number {
  const value = Behave.useMemo(() => 1, [input]);
  const callback = Behave.useCallback(() => undefined, [input]);
  callback();
  return value;
}

export function UnknownCallbackModel(input: number, callback: () => number): number {
  const value = Behave.useMemo(callback, [input]);
  return value;
}

export function MemberCallbackModel(input: { readonly box: { readonly callback: () => number } }): number {
  const value = Behave.useMemo(input.box.callback, [input.box.callback]);
  return value;
}

export function WriteOnlyAssignmentModel(): undefined {
  let value = 0;
  Behave.useEffect(() => {
    value = 1;
  }, []);
  return undefined;
}

export function AliasAndCustomHookModel(input: { readonly user: { readonly id: string } }): undefined {
  const user = input.user;
  const customCommand = useCustomCommand();
  const callback = Behave.useCallback(() => {
    customCommand();
    void user.id;
  }, []);
  Behave.useSignal("callback", callback);
  return undefined;
}

export function WriteOnlyHelperModel(): undefined {
  let value = 0;
  function change(): void {
    value = 1;
  }
  Behave.useEffect(() => change(), []);
  return undefined;
}

export function ReassignedStableCapabilityModel(input: { readonly replacement: () => void }): undefined {
  let [, setValue] = Behave.useState(0);
  setValue = input.replacement;
  Behave.useEffect(() => setValue(1), []);
  return undefined;
}
