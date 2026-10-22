# `usePort(ref)`

다른 instance가 바깥에 내놓은 Signal·Slot·snapshot id를 Model 안에서 쓸 수 있게 합니다.

```ts
function usePort<Port>(ref: TypedModelRef<Port>): DependencyProxy<Port>
```

## 인자

- `ref`: 쓸 instance. 보통 Model input으로 받습니다.

## 반환값

대상의 Port를 따르는 객체입니다.

| 대상의 항목 | 쓰는 방법 |
| --- | --- |
| 연 Signal | [`useEffect`](./useEffect.md)나 callback 안에서 부르거나, [`useConnect`](./useConnect.md)의 `source`로 넘깁니다. |
| Slot | `useConnect`의 `destination`으로 넘깁니다. 부를 수는 없습니다. |
| 연 snapshot id | 읽습니다. |

## 동작

- 대상을 관찰하지 않습니다. 대상의 결과값이 바뀌어도 이 Model은 다시 평가되지 않습니다. 결과값을 읽으려면 [`useModel`](./useModel.md)을 씁니다.
- 대상이 열지 않은 Signal을 꺼내면 오류입니다.

## 예제

`AutoIncrement`는 input으로 받은 `counter`의 `increment`를 1초마다 부릅니다.

```ts
import Behavon, { type Model, type Signal, type TypedModelRef } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

const Counter: Model<undefined, number, CounterPort> = () => {
  const [count, setCount] = Behavon.useState(0)
  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

function AutoIncrement(target: TypedModelRef<CounterPort>): undefined {
  const counter = Behavon.usePort(target)
  Behavon.useEffect(() => {
    const timer = setInterval(() => counter.increment(), 1000)
    return () => clearInterval(timer)
  }, [counter])
  return undefined
}

const counter = Behavon.createModel(Counter, undefined)
const autoIncrement = Behavon.createModel(AutoIncrement, counter)
// counter의 결과값: 처음 0, 1초마다 1씩 증가
```
