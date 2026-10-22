# `useState(initial?)`

The same as React's `useState`. Returns the current value and a setter that changes it and evaluates the Model again.

```ts
function useState<State>(): readonly [State | undefined, StateSetter<State | undefined>]
function useState<State>(initial: State | (() => State)): readonly [State, StateSetter<State>]
```

## Parameters

- `initial`: the first value. If omitted, it is `undefined`. If a function is passed, it is called once at first and its result is used.

## Returns

- The current value.
- A setter: `setValue(next)` or `setValue(previous => next)`. It is always the same function.

## Behavior

- Calling the setter evaluates the Model again in the next microtask. Several calls apply in call order. If the result is the same as the previous value by `Object.is`, that evaluation is not committed: the result stays the same and no Effect runs.
- Calling its own setter in the Model body evaluates again right there. Repeating it more than 25 times is an error.
- Calling the setter of a terminated Model does nothing.

## Example

```ts
function Counter(): string {
  const [count, setCount] = Behavon.useState(0)
  const [label] = Behavon.useState<string>()
  const [items] = Behavon.useState(() => [1, 2, 3])
  Behavon.useEffect(() => {
    setCount(1)
    setCount(n => n + 1)
  }, [setCount])
  return `${label ?? "count"}: ${count + items.length}`
}

const counter = Behavon.createModel(Counter, undefined)
// result: "count: 3" at first, then "count: 5" after the Effect's setters apply
```
