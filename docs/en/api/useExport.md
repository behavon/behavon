# `useExport(port, name, existing?)`

Opens a Signal or snapshot id declared in the Port on the instance. An opened name is used as `instance.name` from outside, and through the result of [`usePort`](./usePort.md) from another Model.

```ts
function useExport<Port>(port: PortDescriptor<Port>, name: keyof Port): Port[typeof name]
function useExport<Port>(port: PortDescriptor<Port>, name: keyof Port, existing: SnapshotRootId<unknown>): Port[typeof name]
```

## Parameters

- `port`, `name`: a Signal or snapshot member declared in [`createPort`](./createPort.md).
- `existing`: for snapshot members only. Opens this id instead of creating a new one. Used to re-expose another Model's snapshot id.

## Returns

| Member | Returns |
| --- | --- |
| Signal | The Signal made by [`useSignal`](./useSignal.md) under the same name. Open it after all `useSignal` calls for that name. |
| snapshot | A new snapshot id for this instance only (or `existing` when passed). Pass it to [`useSnapshot`](./useSnapshot.md) to publish. |

## Behavior

- Every declared Signal and snapshot member must be opened. Leaving one out is an error when the Model is evaluated.
- An opened value stays the one first opened. Evaluating again does not change it.
- Reading an opened value does not observe the Model. Read changing values with [`useModel`](./useModel.md) or `useSnapshot`.

## Example

For opening a Signal, see the [`useSignal`](./useSignal.md) example. Opening a snapshot looks like this:

```ts
import Behavon, { type Model, type SnapshotRootId } from "behavon"

interface CounterPort {
  count: SnapshotRootId<number>
}

const counterPort = Behavon.createPort<CounterPort>({ count: Behavon.SnapshotType() })

const Counter: Model<undefined, number, CounterPort> = () => {
  const countId = Behavon.useExport(counterPort, "count")
  const [count] = Behavon.useState(0)
  const [, publish] = Behavon.useSnapshot(countId)
  Behavon.useEffect(() => publish(count), [count, publish])
  return count
}

const counter = Behavon.createModel(Counter, undefined)
const readCount = Behavon.getSnapshot(counter.count)
readCount() // 0
```
