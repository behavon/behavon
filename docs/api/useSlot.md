# `useSlot(port, name, callback)`

Signal을 받는 Slot을 만듭니다.

```ts
function useSlot<Port>(port: PortDescriptor<Port>, name: keyof Port, callback: (...args: Args) => unknown): Slot<Args>
```

- `port`, `name`: [`createPort`](./createPort.md)에 `SlotType()`으로 선언한 항목. Port가 아니거나 선언하지 않은 이름이면 오류입니다.
- `callback`: 같은 Model에서 [`useCallback`](./useCallback.md)으로 만든 함수.

`callback`은 Signal이 보낸 인자를 받고, 마지막 인자로 `ConnectionMeta`를 하나 더 받습니다.

```ts
interface ConnectionMeta {
  source: TypedModelRef<object>      // 보낸 instance
  signal: string               // 보낸 Signal 이름
  destination: TypedModelRef<object> // 받은 instance
  slot: string                 // 받은 Slot 이름
  connection: Connection
}
```

Slot을 받는 방법은 두 가지입니다.

- 다른 Model이 [`usePort`](./usePort.md)로 이 Slot을 가져와 [`useConnect`](./useConnect.md)로 연결합니다.
- 같은 Model 안에서 반환된 Slot을 직접 호출합니다. 보낸 Signal이 없으므로, `ConnectionMeta.signal`(보낸 Signal의 이름 필드)에는 Slot 이름이 들어갑니다.

Slot은 instance에서 호출할 수 없습니다.

## 예제

```ts
import Behavon, { type ConnectionMeta, type Model, type Slot } from "behavon"

interface LoggerPort {
  log: Slot<[value: number]>
}

const loggerPort = Behavon.createPort<LoggerPort>({ log: Behavon.SlotType() })

const Logger: Model<undefined, undefined, LoggerPort> = () => {
  const log = Behavon.useCallback((value: number, meta?: ConnectionMeta) => {
    console.log(value, meta?.signal)
  }, [])
  const slot = Behavon.useSlot(loggerPort, "log", log)
  Behavon.useEffect(() => {
    slot(1)
  }, [slot])
  return undefined
}

const logger = Behavon.createModel(Logger, undefined)
```

다른 Model의 Signal과 연결하는 방법은 [`useConnect`](./useConnect.md) 예제를 보세요.
