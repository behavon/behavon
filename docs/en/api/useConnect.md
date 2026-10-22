# `useConnect(source, destination)`

Connects a Signal to a Slot so that the Slot is called whenever the Signal is called.

```ts
function useConnect<Args extends readonly unknown[]>(source: Signal<Args>, destination: Slot<Args>): () => void
```

## Parameters

- `source`: the sending Signal. Either the result of [`useSignal`](./useSignal.md) in the same Model, or a Signal another instance opened, taken out with [`usePort`](./usePort.md).
- `destination`: the receiving Slot. Either the result of [`useSlot`](./useSlot.md) in the same Model, or another instance's Slot taken out with `usePort`.

## Returns

A function that disconnects. Calling it twice is an error.

## Behavior

- Only Signals called after connecting are delivered. The Slot is not called at the moment of connecting.
- Connecting the same pair several times delivers once per connection.
- If a Slot throws, later connections are not delivered and the error is thrown to the caller of the Signal.
- The connection ends when the Model that called `useConnect`, the sender, or the receiver is terminated.

## Example

`Counter` sends a `changed` Signal whenever its value changes, and connects that Signal to `Logger`'s Slot.

```ts
import Behavon, { type Model, type Signal, type Slot, type TypedModelRef } from "behavon"

interface LoggerPort {
  log: Slot<[value: number]>
}

const loggerPort = Behavon.createPort<LoggerPort>({ log: Behavon.SlotType() })

const Logger: Model<undefined, undefined, LoggerPort> = () => {
  const log = Behavon.useCallback((value: number) => console.log(value), [])
  Behavon.useSlot(loggerPort, "log", log)
  return undefined
}

interface CounterPort {
  increment: Signal
  changed: Signal<[value: number]>
}

const counterPort = Behavon.createPort<CounterPort>({
  increment: Behavon.SignalType(),
  changed: Behavon.SignalType(),
})

const Counter: Model<TypedModelRef<LoggerPort>, number, CounterPort> = (loggerRef) => {
  const [count, setCount] = Behavon.useState(0)
  const changedBody = Behavon.useCallback((_value: number) => undefined, [])
  const changed = Behavon.useSignal(counterPort, "changed", changedBody)
  Behavon.useExport(counterPort, "changed")
  const logger = Behavon.usePort(loggerRef)
  Behavon.useConnect(changed, logger.log)

  Behavon.useEffect(() => {
    changed(count)
  }, [changed, count])

  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

const logger = Behavon.createModel(Logger, undefined)
const counter = Behavon.createModel(Counter, logger) // logs 0
counter.increment() // logs 1 after evaluating again
```
