# `useSignal(port, name, callback)`

Creates a Signal. Calling the Signal runs `callback` and passes the same arguments to the connected Slots.

```ts
function useSignal<Port>(port: PortDescriptor<Port>, name: keyof Port, callback: (...args: Args) => unknown): Signal<Args>
```

## Parameters

- `port`, `name`: a member declared with `SignalType()` in [`createPort`](./createPort.md).
- `callback`: a function made with [`useCallback`](./useCallback.md) in the same Model. Its argument types must match the declaration.

## Returns

A Signal. Calling it runs the following right there and returns `undefined`:

1. Runs the `callback`s registered under the same name, in registration order.
2. Passes the same arguments to the Slots connected with [`useConnect`](./useConnect.md).

## Behavior

- A declared Signal must be opened with [`useExport`](./useExport.md). Once opened, it can be called on the instance and on the result of [`usePort`](./usePort.md).
- If a `callback` or a Slot throws, it stops there and the error is thrown to the caller of the Signal.
- If `callback` changes state, the Model is evaluated again in the next microtask, after the Signal returns.
- Call it inside [`useEffect`](./useEffect.md) or a callback, not in the Model body. In development mode, calling it in the body prints a warning.

## Example

```ts
import Behavon, { type Model, type Signal, type SnapshotRootId } from "behavon"

interface CounterPort {
  count: SnapshotRootId<number>
  increment: Signal<[by: number]>
}

const counterPort = Behavon.createPort<CounterPort>({
  count: Behavon.SnapshotType(),
  increment: Behavon.SignalType(),
})

const Counter: Model<undefined, number, CounterPort> = () => {
  const countId = Behavon.useExport(counterPort, "count")
  const [count, setCount] = Behavon.useState(0)
  const [, publish] = Behavon.useSnapshot(countId)
  Behavon.useEffect(() => publish(count), [count, publish])

  const increment = Behavon.useCallback((by: number) => setCount(n => n + by), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

const counter = Behavon.createModel(Counter, undefined)
const readCount = Behavon.getSnapshot(counter.count)

counter.increment(2)
readCount() // 0: not evaluated again yet
await Promise.resolve()
readCount() // 2
```
