# `useConnect(source, destination)`

Signal이 호출될 때마다 연결된 Slot을 호출하도록 연결합니다. 연결을 끊는 함수를 반환합니다.

```ts
function useConnect<Args extends readonly unknown[]>(source: Signal<Args>, destination: Slot<Args>): () => void
```

- `source`: 보내는 Signal. 다음 중 하나입니다.
  - 같은 Model의 [`useSignal`](./useSignal.md) 반환값.
  - 다른 instance가 [`useExport`](./useExport.md)로 연 Signal을 [`usePort`](./usePort.md)로 가져온 것.
- `destination`: 받는 Slot. 같은 Model의 [`useSlot`](./useSlot.md) 반환값이나, 다른 instance의 Slot을 `usePort`로 가져온 것.

연결의 동작은 다음과 같습니다.

- 연결하는 순간에는 Slot을 호출하지 않습니다. 연결한 뒤에 호출된 Signal만 전달합니다.
- 같은 쌍을 여러 번 연결하면 연결한 수만큼 따로 전달합니다.
- Slot이 오류를 던지면 그 뒤의 연결로는 전달하지 않고, Signal을 호출한 쪽으로 오류가 전달됩니다.
- `useConnect`를 호출한 Model이 종료되면 연결도 끊깁니다.
- 반환된 함수로 먼저 끊을 수 있습니다. 두 번 호출하면 오류입니다.

## 예제

`Counter`는 값이 바뀔 때마다 `changed` Signal을 발생시키고, 그 Signal을 `Logger`의 Slot에 연결합니다.

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
