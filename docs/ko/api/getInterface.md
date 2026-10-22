# `getInterface(target)`

instance에 등록된 Signal·Slot의 이름과 등록 수를 반환합니다. 디버깅이나 도구에서 씁니다.

```ts
function getInterface(target: TypedModelRef | DependencyProxy): {
  endpoints: readonly { name: string; signalRegistrations: number; slotRegistrations: number }[]
}
```

## 인자

- `target`: [`createModel`](./createModel.md)이 반환한 instance나 [`usePort`](./usePort.md)의 결과. 종료된 instance를 넘기면 오류입니다.

## 반환값

- `endpoints`: 등록한 순서대로 나열한 Signal과 Slot. snapshot id는 들어가지 않습니다.

## 예제

```ts
import Behavon, { type Model, type Signal } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

const Counter: Model<undefined, number, CounterPort> = () => {
  const increment = Behavon.useCallback(() => undefined, [])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return 0
}

const counter = Behavon.createModel(Counter, undefined)
Behavon.getInterface(counter)
// { endpoints: [{ name: "increment", signalRegistrations: 1, slotRegistrations: 0 }] }
```
