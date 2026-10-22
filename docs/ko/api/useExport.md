# `useExport(port, name, existing?)`

Port에 선언한 Signal이나 snapshot id를 instance에 엽니다. 연 이름은 바깥에서 `instance.name`으로, 다른 Model에서 [`usePort`](./usePort.md)의 결과로 씁니다.

```ts
function useExport<Port>(port: PortDescriptor<Port>, name: keyof Port): Port[typeof name]
function useExport<Port>(port: PortDescriptor<Port>, name: keyof Port, existing: SnapshotRootId<unknown>): Port[typeof name]
```

## 인자

- `port`, `name`: [`createPort`](./createPort.md)에 선언한 Signal이나 snapshot 항목.
- `existing`: snapshot 항목에만 씁니다. 새 id를 만들지 않고 이 id를 엽니다. 다른 Model의 snapshot id를 다시 내놓을 때 씁니다.

## 반환값

| 항목 | 반환값 |
| --- | --- |
| Signal | 같은 이름의 [`useSignal`](./useSignal.md)이 만든 Signal. `useSignal`을 모두 부른 뒤에 엽니다. |
| snapshot | 이 instance만의 새 snapshot id(`existing`을 넘기면 그 id). [`useSnapshot`](./useSnapshot.md)에 넘겨 발행합니다. |

## 동작

- 선언한 Signal과 snapshot 항목은 모두 열어야 합니다. 빠뜨리면 Model을 평가할 때 오류입니다.
- 연 값은 처음 연 값으로 고정됩니다. 다시 평가해도 바뀌지 않습니다.
- 연 값을 읽는 것은 Model을 관찰하는 것이 아닙니다. 바뀌는 값은 [`useModel`](./useModel.md)이나 `useSnapshot`으로 읽습니다.

## 예제

Signal을 여는 예제는 [`useSignal`](./useSignal.md)을 보세요. snapshot을 열면 다음과 같습니다.

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
