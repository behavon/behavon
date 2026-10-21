# 주요 개념

Behavon은 React Hook 문법으로 React 밖의 로직을 작성합니다. 화면은 React가, 상태와 동작은 Model이 맡습니다.

## Model

Model은 Hook을 호출하고 결과를 반환하는 함수입니다. React 컴포넌트가 JSX를 반환하듯 Model은 값을 반환합니다.

```ts
function Counter(): number {
  const [count] = Behavon.useState(0)
  return count
}
```

상태가 바뀌면 컴포넌트가 다시 렌더링되는 것처럼 Model이 다시 평가됩니다. Hook 규칙도 React와 같습니다. 항상 같은 순서로, 함수의 최상위에서만 호출합니다.

## Instance

Model은 [`createModel`](./api/createModel.md)로 실행해야 살아 있는 instance가 됩니다. Instance는 [`dispose()`](./api/createModel.md)를 호출할 때까지 유지됩니다.

```ts
const counter = Behavon.createModel(Counter, undefined)
counter.dispose()
```

한 Model은 다른 instance의 결과를 [`useModel`](./api/useModel.md)로 읽을 수 있습니다.

## Signal과 Slot

Signal은 발생시키는 쪽이고, Slot은 받는 쪽입니다. [`useSignal`](./api/useSignal.md)과 [`useSlot`](./api/useSlot.md)으로 만들고, [`useConnect`](./api/useConnect.md)로 둘을 연결합니다. Signal을 만든 것만으로는 Model 밖에서 호출할 수 없습니다.

## 공개

[`createPort`](./api/createPort.md)는 Model이 바깥에 내놓는 이름과 타입을 선언합니다. 선언한 Signal과 snapshot은 [`useExport`](./api/useExport.md)를 호출해야 instance에서 쓸 수 있습니다. 선언한 Slot은 다른 Model이 [`usePort`](./api/usePort.md)로 가져와 연결합니다. instance의 타입은 선언한 Port 타입에서 Slot을 뺀 것입니다. Slot은 instance에서 부를 수 없으므로 나오지 않고, `usePort`로 꺼냅니다.

```ts
import Behavon, { type Model, type Signal } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

const PublicCounter: Model<undefined, number, CounterPort> = () => {
  const [count, setCount] = Behavon.useState(0)
  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

const publicCounter = Behavon.createModel(PublicCounter, undefined)
publicCounter.increment()
```

## Snapshot

Snapshot은 Model이 React 같은 바깥 세계에 공개하는 값입니다. Model은 [`useSnapshot`](./api/useSnapshot.md)으로 값을 발행하고, 바깥은 [`subscribe` / `getSnapshot`](./api/subscribe.md)으로 구독합니다.

## 지원 범위

**서버 렌더링(SSR)과 hydration은 지원하지 않습니다.** React 연결은 클라이언트 렌더링에서만 사용하세요. [`subscribe` / `getSnapshot`](./api/subscribe.md)은 `useSyncExternalStore`의 세 번째 인자인 `getServerSnapshot`에 넘길 값을 제공하지 않습니다.

## 자주 묻는 질문

**`useContext`는 없나요?**
일부러 제공하지 않습니다. Model이 무엇에 의존하는지 코드에 드러나도록, 필요한 instance를 Model input으로 직접 넘깁니다. React 컴포넌트 안에서는 React의 `useContext`를 그대로 쓰면 됩니다.
