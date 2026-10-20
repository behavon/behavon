import React from "react";

const outerValue = 1;

export function ReactDependencyOracle(props: { readonly step: number }): null {
  const [count, setCount] = React.useState(0);
  React.useCallback(() => {
    setCount((current) => current + props.step);
    void count;
  }, []);
  return null;
}

export function ReactDynamicOracle(
  props: { readonly step: number },
  dependencies: readonly unknown[],
): null {
  React.useCallback(() => void props.step, dependencies);
  return null;
}

export function ReactWriteOnlyOracle(): null {
  let value = 0;
  React.useEffect(() => {
    value = 1;
  }, []);
  return null;
}

export function ReactMemberCallbackOracle(props: {
  readonly box: { readonly callback: () => number };
}): null {
  React.useMemo(props.box.callback, [props.box.callback]);
  return null;
}

export function ReactOuterScopeOracle(): null {
  React.useMemo(() => outerValue, [outerValue]);
  return null;
}

export function ReactUnnecessaryOracle(props: {
  readonly value: number;
  readonly extra: number;
}): null {
  React.useMemo(() => props.value, [props.value, props.extra]);
  return null;
}

export function ReactDuplicateOracle(props: { readonly value: number }): null {
  React.useMemo(() => props.value, [props.value, props.value]);
  return null;
}

export function ReactComplexOracle(props: { readonly value: number }): null {
  React.useMemo(() => props.value, [props.value + 1]);
  return null;
}

export function ReactWriteOnlyHelperOracle(): null {
  let value = 0;
  function change(): void {
    value = 1;
  }
  React.useEffect(() => change(), []);
  return null;
}

export function ReactReassignedStableCapabilityOracle(props: {
  readonly replacement: React.Dispatch<React.SetStateAction<number>>;
}): null {
  let [, setValue] = React.useState(0);
  setValue = props.replacement;
  React.useEffect(() => setValue(1), []);
  return null;
}
