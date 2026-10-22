# `getInterface(target)`

Returns the names and registration counts of the Signals and Slots registered on an instance. Used for debugging and tooling.

```ts
function getInterface(target: TypedModelRef | DependencyProxy): {
  endpoints: readonly { name: string; signalRegistrations: number; slotRegistrations: number }[]
}
```

## Parameters

- `target`: an instance returned by [`createModel`](./createModel.md), or the result of [`usePort`](./usePort.md). Passing a terminated instance is an error.

## Returns

- `endpoints`: the Signals and Slots in registration order. Snapshot ids are not included.

## Example

```ts
import Behavon, { type Model, type Signal } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

const Counter: Model<undefined, number, CounterPort> = () => {
  const increment = Behavon.useCallback(() => undefined, [])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return 0
}

const counter = Behavon.createModel(Counter, undefined)
Behavon.getInterface(counter)
// { endpoints: [{ name: "increment", signalRegistrations: 1, slotRegistrations: 0 }] }
```
