# `TypedModelRef<Needs>`

The type for receiving an instance with only the members the receiver needs.

```ts
type TypedModelRef<Needs> = Readonly<{ [Name in keyof Needs as Needs[Name] extends Slot ? never : Name]: Needs[Name] }> & { dispose(): void }
```

## Behavior

- `Needs` lists only the names the receiver uses. An instance whose Port includes `Needs` can be passed as is.
- Slots cannot be called on a ref, so they do not appear. Passing the ref to [`usePort`](./usePort.md) takes out its Slots for [`useConnect`](./useConnect.md).
- Only an instance returned by [`createModel`](./createModel.md) fits. A plain object of the same shape does not.
- A ref cannot read the result. [`useModel`](./useModel.md) needs the `ModelInstance` type.

## Example

`IncrementButton` only uses `increment`, so it receives a `TypedModelRef<CounterNeeds>`. The `counter` that uses `CounterPort` can be passed as is.

```tsx
import Behavon, { type Model, type Signal, type SnapshotRootId, type TypedModelRef } from "behavon"

interface CounterPort {
  count: SnapshotRootId<number>
  increment: Signal
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
  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

interface CounterNeeds {
  increment: Signal
}

function IncrementButton({ counter }: { readonly counter: TypedModelRef<CounterNeeds> }) {
  return <button onClick={() => counter.increment()}>+1</button>
}

const counter = Behavon.createModel(Counter, undefined)
const button = <IncrementButton counter={counter} />
```
