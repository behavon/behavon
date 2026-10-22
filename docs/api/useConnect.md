# `useConnect(source, destination)`

Signal이 불릴 때마다 Slot이 불리도록 연결합니다.

```ts
function useConnect<Args extends readonly unknown[]>(source: Signal<Args>, destination: Slot<Args>): () => void
```

## 인자

- `source`: 보내는 Signal. 같은 Model의 [`useSignal`](./useSignal.md) 결과이거나, 다른 instance가 연 Signal을 [`usePort`](./usePort.md)로 꺼낸 것.
- `destination`: 받는 Slot. 같은 Model의 [`useSlot`](./useSlot.md) 결과이거나, 다른 instance의 Slot을 `usePort`로 꺼낸 것.

## 반환값

연결을 끊는 함수. 두 번 부르면 오류입니다.

## 동작

- 연결한 뒤에 불린 Signal만 전달합니다. 연결하는 순간에는 Slot을 부르지 않습니다.
- 같은 쌍을 여러 번 연결하면 연결한 수만큼 따로 전달합니다.
- Slot이 throw하면 그 뒤의 연결로는 전달하지 않고, 그 오류가 Signal을 부른 쪽으로 throw됩니다.
- `useConnect`를 부른 Model, 보내는 쪽, 받는 쪽 중 하나가 종료되면 연결도 끊깁니다.

## 예제

`Counter`는 값이 바뀔 때마다 `changed` Signal을 보내고, 그 Signal을 `Logger`의 Slot에 연결합니다.

```ts
import Behavon, { type Model, type Signal, type Slot, type TypedModelRef } from "behavon"

interface LoggerPort {
  log: Slot<[value: number]>
}

const loggerPort = Behavon.createPort<LoggerPort>({ log: Behavon.SlotType() })

const Logger: Model<undefined, undefined, LoggerPort> = () => {
  const log = Behavon.useCallback((value: number) => console.log(value), [])
  Behavon.useSlot(loggerPort, "log", log)
  return undefined
}

interface CounterPort {
  increment: Signal
  changed: Signal<[value: number]>
}

const counterPort = Behavon.createPort<CounterPort>({
  increment: Behavon.SignalType(),
  changed: Behavon.SignalType(),
})

const Counter: Model<TypedModelRef<LoggerPort>, number, CounterPort> = (loggerRef) => {
  const [count, setCount] = Behavon.useState(0)
  const changedBody = Behavon.useCallback((_value: number) => undefined, [])
  const changed = Behavon.useSignal(counterPort, "changed", changedBody)
  Behavon.useExport(counterPort, "changed")
  const logger = Behavon.usePort(loggerRef)
  Behavon.useConnect(changed, logger.log)

  Behavon.useEffect(() => {
    changed(count)
  }, [changed, count])

  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

const logger = Behavon.createModel(Logger, undefined)
const counter = Behavon.createModel(Counter, logger) // 0 출력
counter.increment() // 다시 평가된 뒤 1 출력
```
