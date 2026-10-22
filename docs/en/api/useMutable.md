# `useMutable(initial)`

Returns a handle that holds a value without causing evaluation. Use it to remember values that do not need to be shown.

```ts
function useMutable<State>(initial: State): {
  get(): State
  set(update: State | ((previous: State) => State)): void
}
```

## Parameters

- `initial`: the first value. A function is not called; the function itself is stored.

## Returns

A handle. It is always the same object.

- `get()`: reads the current value.
- `set(next)` / `set(previous => next)`: changes the value right away. To store a function, wrap it as `set(() => fn)`.

## Behavior

- `set` does not evaluate the Model again.
- The handle points to that Model's state. Using it after the Model is terminated is an error.

## Example

```ts
function Sender(): number {
  const sent = Behavon.useMutable(0)
  const [, setTick] = Behavon.useState(0)
  Behavon.useEffect(() => {
    sent.set(n => n + 1)
    setTick(sent.get())
  }, [sent, setTick])
  return sent.get()
}

const sender = Behavon.createModel(Sender, undefined)
// result: 0 at first. sent.set alone does not evaluate again; after setTick causes an evaluation, 1
```
