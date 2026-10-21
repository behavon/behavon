# `useSignal(port, name, callback)`

Signal을 만들고, 그 Signal을 발생시키는 함수를 반환합니다.

```ts
function useSignal<Port>(port: PortDescriptor<Port>, name: keyof Port, callback: (...args: Args) => unknown): Signal<Args>
```

- `port`, `name`: [`createPort`](./createPort.md)에 `SignalType()`으로 선언한 항목. Port가 아니거나 선언하지 않은 이름이면 오류입니다. `callback`의 인자 타입은 선언과 맞아야 합니다.
- `callback`: 같은 Model에서 [`useCallback`](./useCallback.md)으로 만든 함수. 일반 함수를 넘기면 오류입니다.

반환된 Signal을 호출하면 다음 순서로 실행됩니다.

1. 같은 이름으로 등록한 `callback`을 등록 순서대로 그 자리에서 실행합니다.
2. `useConnect`로 연결된 Slot에 같은 인자를 전달합니다.

반환값은 항상 `undefined`입니다. `callback`이 오류를 던지면 거기서 멈추고 그 오류가 호출한 쪽으로 전달됩니다. `callback`에서 state를 바꾸면 Model은 호출 직후가 아니라 다음 microtask에 다시 평가됩니다.

Port에 선언한 Signal은 [`useExport(port, name)`](./useExport.md)로 열어야 합니다. 열지 않으면 Model을 만들 때 오류입니다. 같은 이름의 `useSignal`을 모두 부른 뒤에 엽니다. 연 뒤에 같은 이름으로 다시 등록하면 오류입니다. 연 Signal은 instance와 [`usePort`](./usePort.md) 결과에서 호출할 수 있습니다. 종료된 Model의 Signal을 호출하면 오류입니다.

Model 본문에서 바로 호출하지 말고 [`useEffect`](./useEffect.md)나 다른 callback 안에서 호출하세요. 개발 모드에서는 본문에서 호출하면 경고를 출력합니다.

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
