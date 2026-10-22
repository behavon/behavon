# `useSlot(port, name, callback)`

Creates a Slot that receives another Model's Signal.

```ts
function useSlot<Port>(port: PortDescriptor<Port>, name: keyof Port, callback: (...args: Args) => unknown): Slot<Args>
```

## Parameters

- `port`, `name`: a member declared with `SlotType()` in [`createPort`](./createPort.md).
- `callback`: a function made with [`useCallback`](./useCallback.md) in the same Model. It receives the arguments the Signal sent.

## Returns

A Slot. Inside the same Model it can also be called directly.

## Behavior

- When another Model takes this Slot out with [`usePort`](./usePort.md) and connects it with [`useConnect`](./useConnect.md), `callback` runs every time the connected Signal is called.
- A Slot cannot be called on an instance.
- When called through a connection, `callback` receives the connection information as one more, last argument. Its value for a direct call inside the same Model is not decided yet, so do not rely on it.

```ts
interface ConnectionMeta {
  source: TypedModelRef<object>      // the sending instance
  signal: string                     // the name of the sending Signal
  destination: TypedModelRef<object> // the receiving instance
  slot: string                       // the name of the receiving Slot
  connection: Connection
}
```

## Example

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

const logger = Behavon.createModel(Logger, undefined) // logs 1
```

For connecting to another Model's Signal, see the [`useConnect`](./useConnect.md) example.
