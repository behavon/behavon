# `useCallback(callback, dependencies)`

The same as React's `useCallback`. Returns a new function only when its dependencies change.

```ts
function useCallback<Callback extends Function>(callback: Callback, dependencies: readonly unknown[]): Callback
```

## Parameters

- `callback`: the function to remember.
- `dependencies`: if all are the same as before by `Object.is`, the previous function is returned. They cannot be omitted, and changing their length is an error.

## Returns

A function wrapping `callback`. It is a different object from the function passed, but behaves the same, passing `this` and the arguments through.

## Behavior

- [`useSignal`](./useSignal.md) and [`useSlot`](./useSlot.md) accept only functions made with `useCallback` in the same Model.

## Example

```ts
function Greeter(name: string): string {
  const greet = Behavon.useCallback(() => `hello, ${name}`, [name])
  return greet()
}

const greeter = Behavon.createModel(Greeter, "Kim")
// result: "hello, Kim"
```
