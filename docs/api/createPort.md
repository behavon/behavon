# `createPort<Port>(declaration)`

Model이 바깥에 내놓는 이름과 타입을 선언합니다. 이 선언을 쓰는 Model의 instance는 `Port` 타입을 가집니다.

```ts
function createPort<Port>(declaration: { [Name in keyof Port]: Marker }): PortDescriptor<Port>
```

- `Port`: 이름과 타입을 적은 interface. 각 항목은 `Signal<Args>`, `Slot<Args>`, `SnapshotRootId<T>` 중 하나입니다.
- `declaration`: `Port`의 각 key에 맞는 marker를 적은 객체.

| `Port` 항목 | marker | 채우는 Hook |
| --- | --- | --- |
| `Signal<Args>` | `Behavon.SignalType()` | [`useSignal(port, name, callback)`](./useSignal.md) 후 [`useExport(port, name)`](./useExport.md) |
| `Slot<Args>` | `Behavon.SlotType()` | [`useSlot(port, name, callback)`](./useSlot.md) |
| `SnapshotRootId<T>` | `Behavon.SnapshotType()` | [`useExport(port, name)`](./useExport.md) |

marker의 타입 인자는 `Port`에서 정해지므로 다시 적지 않아도 됩니다.

## 규칙

- 모듈 최상위에서 호출합니다. Model이 평가되는 도중에 부르면 오류입니다.
- Model은 `Model<Input, Output, Port>`로 타입을 적습니다.
- 선언한 항목은 모두 채워야 합니다. 빠뜨리면 Model을 만들 때 오류입니다.
- Port에 없는 Signal은 `useSignal(name, callback)`으로 만들 수 있지만 바깥에서 쓸 수 없습니다. Port에 없는 Slot과 공개 값은 오류입니다.
- 한 Model은 Port를 하나만 씁니다. 두 Port를 섞으면 오류입니다.
- `declaration`에는 `Port`의 모든 key를 직접 적습니다. 빠진 key, 남는 key, 역할이 다른 marker는 타입 오류입니다.

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
