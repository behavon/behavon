# `createModel(model, initialInput)`

Model을 실행해 살아 있는 instance를 만듭니다.

```ts
function createModel<Input, Output, Port>(
  model: Model<Input, Output, Port>,
  initialInput: Input,
): ModelInstance<Input, Output, Port>
```

## 인자

- `model`: 실행할 Model. 모듈 최상위에 정의한 함수입니다.
- `initialInput`: Model이 처음 받을 input.

## 반환값

instance를 반환합니다.

- [`useExport`](./useExport.md)로 연 Signal과 snapshot id를 이름으로 씁니다(`counter.increment()`, `counter.count`).
- 다른 Model의 [`useModel`](./useModel.md)·[`usePort`](./usePort.md)에 넘깁니다.
- `dispose()`로 종료합니다. 두 번 부르면 오류입니다.

Model의 결과값은 instance에서 읽지 않습니다. 다른 Model은 `useModel`로, React는 [`useSnapshot`](./useSnapshot.md)으로 발행한 값을 읽습니다.

## 동작

- 첫 평가와 첫 [`useEffect`](./useEffect.md) 실행까지 마친 뒤 반환합니다. 그 사이에 오류가 나면 그 오류를 throw하고 instance는 남지 않습니다.
- Model을 평가하는 도중에는 부를 수 없습니다.

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
