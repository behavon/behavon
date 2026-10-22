# `useSlot(port, name, callback)`

다른 Model의 Signal을 받는 Slot을 만듭니다.

```ts
function useSlot<Port>(port: PortDescriptor<Port>, name: keyof Port, callback: (...args: Args) => unknown): Slot<Args>
```

## 인자

- `port`, `name`: [`createPort`](./createPort.md)에 `SlotType()`으로 선언한 항목.
- `callback`: 같은 Model에서 [`useCallback`](./useCallback.md)으로 만든 함수. Signal이 보낸 인자를 받습니다.

## 반환값

Slot. 같은 Model 안에서는 직접 부를 수도 있습니다.

## 동작

- 다른 Model이 [`usePort`](./usePort.md)로 이 Slot을 꺼내 [`useConnect`](./useConnect.md)로 연결하면, 연결된 Signal이 불릴 때마다 `callback`이 실행됩니다.
- Slot은 instance에서 부를 수 없습니다.
- 연결을 거쳐 불리면 `callback`은 마지막 인자로 연결 정보를 하나 더 받습니다. 같은 Model 안에서 직접 부른 경우의 이 값은 아직 정해지지 않았으니 기대지 마세요.

```ts
interface ConnectionMeta {
  source: TypedModelRef<object>      // 보낸 instance
  signal: string                     // 보낸 Signal 이름
  destination: TypedModelRef<object> // 받은 instance
  slot: string                       // 받은 Slot 이름
  connection: Connection
}
```

## 예제

```ts
import Behavon, { type Model, type Slot } from "behavon"

interface LoggerPort {
  log: Slot<[value: number]>
}

const loggerPort = Behavon.createPort<LoggerPort>({ log: Behavon.SlotType() })

const Logger: Model<undefined, undefined, LoggerPort> = () => {
  const log = Behavon.useCallback((value: number) => console.log(value), [])
  const slot = Behavon.useSlot(loggerPort, "log", log)
  Behavon.useEffect(() => {
    slot(1)
  }, [slot])
  return undefined
}

const logger = Behavon.createModel(Logger, undefined) // 1 출력
```

다른 Model의 Signal과 연결하는 방법은 [`useConnect`](./useConnect.md) 예제를 보세요.
