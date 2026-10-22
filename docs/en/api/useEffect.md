# `useEffect(effect, dependencies?)`

The same as React's `useEffect`. Registers work to run after an evaluation is committed.

```ts
function useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void
```

## Parameters

- `effect`: the work to run. If it returns a function, that function is called as cleanup before the next run and when the Model is terminated.
- `dependencies`: if omitted, it runs after every committed evaluation; with `[]`, only once at first; with `[a, b]`, only when a value changed by `Object.is`. Switching between omitted and an array, or changing the length, is an error.

## Behavior

- The first run finishes before [`createModel`](./createModel.md) returns.
- Work that affects the outside, such as publishing a snapshot, calling a Signal, or a network request, belongs here, not in the Model body.

## Example

```ts
function Clock(): number {
  const [now, setNow] = Behavon.useState(0)
  Behavon.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [setNow])
  return now
}

const clock = Behavon.createModel(Clock, undefined)
// result: 0 at first, then Date.now() at that moment every second
// calling clock.dispose() makes the cleanup function call clearInterval
```
