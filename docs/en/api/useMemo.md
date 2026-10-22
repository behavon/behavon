# `useMemo(factory, dependencies)`

The same as React's `useMemo`. Recomputes a value only when its dependencies change.

```ts
function useMemo<Value>(factory: () => Value, dependencies: readonly unknown[]): Value
```

## Parameters

- `factory`: computes the value. It cannot call Hooks.
- `dependencies`: if all are the same as before by `Object.is`, the previous value is used. They cannot be omitted, and changing their length is an error.

## Returns

The computed value.

## Example

```ts
function Report(items: readonly number[]): number {
  const total = Behavon.useMemo(() => items.reduce((sum, n) => sum + n, 0), [items])
  return total
}

const report = Behavon.createModel(Report, [1, 2, 3])
// result: 6
```
