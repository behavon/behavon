# `usePort(ref)`

Model 안에서 다른 instance가 바깥에 내놓은 것을 쓸 수 있는 객체를 반환합니다.

```ts
function usePort<Port>(ref: TypedModelRef<Port>): DependencyProxy<Port>
function usePort(ref: UntypedModelRef): DependencyProxy
```

- `ref`: 쓸 instance. 보통 Model input으로 받습니다.
- Port 타입이 있는 instance를 넘기면 반환된 객체도 그 타입을 가집니다. Port가 없는 instance이면 모든 이름이 `any`입니다.

반환된 객체로 쓸 수 있는 것은 다음과 같습니다.

| 대상 instance의 항목 | 쓰는 방법 |
| --- | --- |
| [`useExport`](./useExport.md)로 공개한 Signal | [`useEffect`](./useEffect.md)나 callback 안에서 호출하거나, [`useConnect`](./useConnect.md)의 `source`로 넘깁니다. |
| Slot | `useConnect`의 `destination`으로 넘깁니다. 호출할 수는 없습니다. |
| `useExport`로 공개한 값 | 읽습니다. |

공개하지 않은 Signal을 꺼내면 오류입니다. 대상의 결과값을 읽으려면 [`useModel`](./useModel.md)을 씁니다. `usePort`는 대상을 관찰하지 않으므로 대상이 바뀌어도 이 Model이 다시 평가되지 않습니다.

## 예제

`AutoIncrement`는 input으로 받은 `counter`의 `increment`를 1초마다 호출합니다.

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
