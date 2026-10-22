# 주요 개념

Behavon은 React Hook 문법으로 React 밖의 로직을 작성합니다. 화면은 React가, 상태와 동작은 Model이 맡습니다.

## Model

Model은 Hook을 부르고 값을 반환하는 함수입니다. React 컴포넌트가 JSX를 반환하듯 Model은 결과값을 반환합니다.

```ts
function Counter(): number {
  const [count] = Behavon.useState(0)
  return count
}
```

상태가 바뀌면 컴포넌트가 다시 렌더링되듯 Model이 다시 평가됩니다. Hook 규칙도 React와 같습니다. 항상 같은 순서로, 함수의 최상위에서만 부릅니다.

## Instance

Model은 [`createModel`](./api/createModel.md)로 실행해야 살아 있는 instance가 됩니다. instance는 `dispose()`를 부를 때까지 유지됩니다.

```ts
const counter = Behavon.createModel(Counter, undefined)
counter.dispose()
```

instance끼리는 두 가지로 이어집니다.

- [`useModel`](./api/useModel.md): 다른 instance의 결과값을 읽고, 그 값이 바뀌면 다시 평가됩니다.
- [`usePort`](./api/usePort.md): 다른 instance가 내놓은 Signal·Slot·snapshot id를 씁니다.

필요한 instance는 Model input으로 넘깁니다. `useContext` 같은 암묵적인 주입은 없습니다.

## Port

[`createPort`](./api/createPort.md)는 Model이 바깥에 내놓을 이름과 타입을 선언합니다. 선언할 수 있는 것은 세 가지입니다.

| 항목 | 역할 | 채우는 Hook |
| --- | --- | --- |
| `Signal` | 바깥에서 부르는 명령이나, 연결된 Slot에 알리는 이벤트 | [`useSignal`](./api/useSignal.md) + [`useExport`](./api/useExport.md) |
| `Slot` | 다른 Model의 Signal을 받는 자리 | [`useSlot`](./api/useSlot.md) |
| `SnapshotRootId` | React 같은 바깥이 읽을 값의 식별자 | [`useExport`](./api/useExport.md) |

instance에서는 연 Signal과 snapshot id를 이름으로 씁니다(`counter.increment()`, `counter.count`). Slot은 instance에서 부를 수 없고, 다른 Model이 `usePort`로 꺼내 연결합니다.

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

## Signal과 Slot

Signal을 부르면 그 Signal의 함수를 실행하고, [`useConnect`](./api/useConnect.md)로 연결된 Slot에 같은 인자를 전달합니다. 모두 그 자리에서 동기로 실행됩니다. 함수 안에서 state를 바꾸면 Model은 다음 microtask에 다시 평가됩니다.

## Snapshot

Snapshot은 Model이 React 같은 바깥에 보여 주는 값입니다. Model은 [`useSnapshot`](./api/useSnapshot.md)으로 발행하고, 바깥은 [`subscribe` / `getSnapshot`](./api/subscribe.md)으로 읽습니다.

## 오류와 종료

| 어디서 오류가 나는가 | 결과 |
| --- | --- |
| Signal·Slot 함수가 throw | 그 Signal을 부른 쪽으로 바로 throw됩니다. Model은 종료되지 않습니다. |
| Signal·Slot 함수가 reject되는 Promise를 반환 | 받는 쪽이 없는 비동기 오류(`unhandledRejection`)가 됩니다. |
| 첫 평가나 첫 Effect | `createModel`이 그 오류를 throw하고 instance는 만들어지지 않습니다. |
| state 변경으로 다시 평가하다가, 또는 그 뒤 Effect에서 | Model이 종료되고, 오류는 React가 처리하지 못한 렌더링 오류를 알리는 방식으로 보고됩니다(`reportError`, 없으면 `error` 이벤트, Node는 `process`의 `uncaughtException` 이벤트). state를 바꾼 Signal은 정상으로 반환합니다. |
| [`transaction.commit`](./api/transaction.md)의 평가 | Model이 종료되고, `commit`이 그 오류를 throw합니다. |

Model이 종료되면(오류든 `dispose()`든) 다음이 일어납니다.

- Effect 정리 함수가 실행되고, 외부 store 구독이 해제되고, Resource가 `abort`되고, 진행 중인 Future가 취소됩니다.
- 그 Model이 보내거나 받던 연결이 끊깁니다.
- 그 Model을 `useModel`로 읽던 Model도 종료됩니다. 대상이 오류로 종료됐으면 같은 오류로, `dispose()`됐으면 `disposed during model observation` 오류로 종료되고, 각각 위와 같은 방식으로 보고됩니다.
- 종료된 instance의 Signal을 부르거나, `useModel`·`usePort`·`getInterface`에 넘기면 오류입니다. 종료된 Model의 `useState` setter는 아무 일도 하지 않습니다.

## 지원 범위

**서버 렌더링(SSR)과 hydration은 지원하지 않습니다.** [`subscribe` / `getSnapshot`](./api/subscribe.md)은 `useSyncExternalStore`의 세 번째 인자 `getServerSnapshot`에 넘길 값을 제공하지 않습니다.
