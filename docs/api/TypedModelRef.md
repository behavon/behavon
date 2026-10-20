# `TypedModelRef<Needs>` / `UntypedModelRef`

Instance를 받는 쪽에서 쓰는 타입입니다.

```ts
type TypedModelRef<Needs> = Readonly<Needs> & { dispose(): void }
type UntypedModelRef = Readonly<Record<string, any>> & { dispose(): void }
```

- `TypedModelRef<Needs>`: 받는 쪽이 쓸 이름만 적은 타입. [`createPort`](./createPort.md)의 Port를 쓰는 instance는 `Needs`가 그 Port의 일부이면 그대로 넘길 수 있습니다.
- `UntypedModelRef`: Port가 없는 instance의 타입. 모든 이름이 `any`라서 이름이 틀려도 컴파일됩니다.

`TypedModelRef`로는 결과값을 읽을 수 없습니다. [`useModel`](./useModel.md)에는 `ModelInstance` 타입이 필요합니다. 일반 객체는 `TypedModelRef`에 넣을 수 없고, `createModel`이 반환한 instance만 넣을 수 있습니다.

## 예제

`IncrementButton`은 `increment`만 필요하므로 `TypedModelRef<CounterNeeds>`로 받습니다. `CounterPort`를 쓰는 `counter`를 그대로 넘길 수 있습니다.

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
