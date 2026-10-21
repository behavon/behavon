# `createModel(model, initialInput)`

Model을 실행해 살아 있는 instance를 만듭니다. 첫 평가와 첫 [`useEffect`](./useEffect.md) 실행까지 끝낸 뒤 반환합니다.

```ts
function createModel<Input, Output, Port>(
  model: Model<Input, Output, Port>,
  initialInput: Input,
): ModelInstance<Input, Output, Port>
```

- `model`: 실행할 Model 함수. 모듈 최상위에 정의한 함수여야 합니다.
- `initialInput`: Model이 처음 받을 input.

반환된 instance로 할 수 있는 일은 다음과 같습니다.

- [`useExport`](./useExport.md)로 공개한 Signal을 호출하고 공개한 값을 읽습니다. 공개하지 않은 이름을 읽으면 오류입니다.
- 다른 Model의 [`useModel`](./useModel.md), [`usePort`](./usePort.md)에 넘깁니다.
- `dispose()`로 종료합니다. 두 번 호출하면 오류입니다.

Model이 [`createPort`](./createPort.md)의 Port를 쓰면 instance는 그 Port 타입에서 Slot을 뺀 타입을 가집니다. Slot은 instance에서 부를 수 없고, 다른 Model이 [`usePort`](./usePort.md)로 꺼내 연결합니다. Port가 없는 Model의 instance에는 `dispose()`만 있습니다. Model 결과값은 instance에서 직접 읽지 않고 `useModel`이나 [`useSnapshot`](./useSnapshot.md)으로 읽습니다.

Model이 평가되는 도중에는 호출할 수 없습니다. 첫 평가에서 오류가 나면 그 오류를 그대로 던지고 instance는 만들어지지 않습니다. 오류를 결과값으로 받으려면 [`boundary`](./boundary.md)를 씁니다.

## 예제

```ts
import Behavon, { type Model, type Signal } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

const Counter: Model<number, number, CounterPort> = (start) => {
  const [count, setCount] = Behavon.useState(start)
  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

const counter = Behavon.createModel(Counter, 10)
counter.increment()
counter.dispose()
```
