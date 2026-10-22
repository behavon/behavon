# `useSignal(port, name, callback)`

Signal을 만듭니다. Signal을 부르면 `callback`을 실행하고, 연결된 Slot에 같은 인자를 전달합니다.

```ts
function useSignal<Port>(port: PortDescriptor<Port>, name: keyof Port, callback: (...args: Args) => unknown): Signal<Args>
```

## 인자

- `port`, `name`: [`createPort`](./createPort.md)에 `SignalType()`으로 선언한 항목.
- `callback`: 같은 Model에서 [`useCallback`](./useCallback.md)으로 만든 함수. 인자 타입은 선언과 맞아야 합니다.

## 반환값

Signal. 부르면 다음을 그 자리에서 실행하고 `undefined`를 반환합니다.

1. 같은 이름으로 등록한 `callback`을 등록 순서대로 실행합니다.
2. [`useConnect`](./useConnect.md)로 연결된 Slot에 같은 인자를 전달합니다.

## 동작

- 선언한 Signal은 [`useExport`](./useExport.md)로 열어야 합니다. 열면 instance와 [`usePort`](./usePort.md)의 결과에서 부를 수 있습니다.
- `callback`이나 Slot이 throw하면 거기서 멈추고, 그 오류가 Signal을 부른 쪽으로 throw됩니다.
- `callback`에서 state를 바꾸면 Model은 Signal이 반환한 뒤 다음 microtask에 다시 평가됩니다.
- Model 본문에서 부르지 말고 [`useEffect`](./useEffect.md)나 callback 안에서 부릅니다. 개발 모드에서는 본문에서 부르면 경고를 출력합니다.

## 예제

```ts
import Behavon, { type Model, type Signal, type SnapshotRootId } from "behavon"

interface CounterPort {
  count: SnapshotRootId<number>
  increment: Signal<[by: number]>
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

  const increment = Behavon.useCallback((by: number) => setCount(n => n + by), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

const counter = Behavon.createModel(Counter, undefined)
const readCount = Behavon.getSnapshot(counter.count)

counter.increment(2)
readCount() // 0: 아직 다시 평가되기 전
await Promise.resolve()
readCount() // 2
```
