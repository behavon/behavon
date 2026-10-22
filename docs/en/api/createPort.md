# `createPort<Port>(declaration)`

Declares the names and types a Model exposes.

```ts
function createPort<Port>(declaration: { [Name in keyof Port]: Marker }): PortDescriptor<Port>
```

## Parameters

- `Port`: an interface listing names and types. Each member is one of `Signal<Args>`, `Slot<Args>`, or `SnapshotRootId<T>`.
- `declaration`: an object with a marker for each name in `Port`. The type arguments come from `Port`, so they are not repeated.

| `Port` member | Marker | How the Model fills it |
| --- | --- | --- |
| `Signal<Args>` | `Behavon.SignalType()` | Implement it with [`useSignal`](./useSignal.md) and open it with [`useExport`](./useExport.md). |
| `Slot<Args>` | `Behavon.SlotType()` | Implement it with [`useSlot`](./useSlot.md). |
| `SnapshotRootId<T>` | `Behavon.SnapshotType()` | Open it with [`useExport`](./useExport.md). |

## Returns

A Port descriptor, passed as the first argument of `useSignal`, `useSlot`, and `useExport`.

## Behavior

- Create it once at module top level.
- Type the Model as `Model<Input, Output, Port>`. The instance returned by [`createModel`](./createModel.md) then has the type of `Port` without its Slots.
- The Model must fill every declared member. Leaving one out, using an undeclared name, or mixing two Ports in one Model is an error when the Model is evaluated.

## Example

```ts
import Behavon, { type Model, type Signal, type Slot, type SnapshotRootId } from "behavon"

interface CounterPort {
  count: SnapshotRootId<number>
  increment: Signal
  set: Slot<[value: number]>
}

const counterPort = Behavon.createPort<CounterPort>({
  count: Behavon.SnapshotType(),
  increment: Behavon.SignalType(),
  set: Behavon.SlotType(),
})

const Counter: Model<undefined, number, CounterPort> = () => {
  const countId = Behavon.useExport(counterPort, "count")
  const [count, setCount] = Behavon.useState(0)
  const [, publish] = Behavon.useSnapshot(countId)
  Behavon.useEffect(() => publish(count), [count, publish])

  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")

  const set = Behavon.useCallback((value: number) => setCount(value), [setCount])
  Behavon.useSlot(counterPort, "set", set)
  return count
}

const counter = Behavon.createModel(Counter, undefined)
counter.increment()
const read = Behavon.getSnapshot(counter.count)
```
