# `createPort<Port>(declaration)`

Model이 바깥에 내놓을 이름과 타입을 선언합니다.

```ts
function createPort<Port>(declaration: { [Name in keyof Port]: Marker }): PortDescriptor<Port>
```

## 인자

- `Port`: 이름과 타입을 적은 interface. 각 항목은 `Signal<Args>`, `Slot<Args>`, `SnapshotRootId<T>` 중 하나입니다.
- `declaration`: `Port`의 각 이름에 맞는 marker를 적은 객체. 타입 인자는 `Port`에서 정해지므로 다시 적지 않습니다.

| `Port` 항목 | marker | Model에서 채우는 방법 |
| --- | --- | --- |
| `Signal<Args>` | `Behavon.SignalType()` | [`useSignal`](./useSignal.md)로 구현하고 [`useExport`](./useExport.md)로 엽니다. |
| `Slot<Args>` | `Behavon.SlotType()` | [`useSlot`](./useSlot.md)으로 구현합니다. |
| `SnapshotRootId<T>` | `Behavon.SnapshotType()` | [`useExport`](./useExport.md)로 엽니다. |

## 반환값

Port descriptor. `useSignal`·`useSlot`·`useExport`의 첫 인자로 넘깁니다.

## 동작

- 모듈 최상위에서 한 번 만듭니다.
- Model의 타입은 `Model<Input, Output, Port>`로 적습니다. 그러면 [`createModel`](./createModel.md)이 반환하는 instance가 `Port`에서 Slot을 뺀 타입을 가집니다.
- 선언한 항목은 Model이 모두 채워야 합니다. 빠뜨리거나, 선언하지 않은 이름을 쓰거나, 한 Model에서 Port 두 개를 섞으면 Model을 평가할 때 오류입니다.

## 예제

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
