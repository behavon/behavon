# `TypedModelRef<Needs>`

instance를 받는 쪽에서, 필요한 항목만 적어 받는 타입입니다.

```ts
type TypedModelRef<Needs> = Readonly<{ [Name in keyof Needs as Needs[Name] extends Slot ? never : Name]: Needs[Name] }> & { dispose(): void }
```

## 동작

- `Needs`에는 받는 쪽이 쓸 이름만 적습니다. instance의 Port가 `Needs`를 포함하면 그대로 넘길 수 있습니다.
- Slot은 ref에서 부를 수 없으므로 나오지 않습니다. ref를 [`usePort`](./usePort.md)에 넘기면 Slot을 꺼내 [`useConnect`](./useConnect.md)에 쓸 수 있습니다.
- [`createModel`](./createModel.md)이 반환한 instance만 넣을 수 있습니다. 같은 모양의 일반 객체는 넣을 수 없습니다.
- ref로는 결과값을 읽지 못합니다. [`useModel`](./useModel.md)에는 `ModelInstance` 타입이 필요합니다.

## 예제

`IncrementButton`은 `increment`만 쓰므로 `TypedModelRef<CounterNeeds>`로 받습니다. `CounterPort`를 쓰는 `counter`를 그대로 넘길 수 있습니다.

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
