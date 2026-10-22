# 시작하기

## 설치

```sh
npm install behavon
```

## import

세 방식 모두 같은 함수를 가져옵니다. 이 문서는 default import를 씁니다.

| 방식 | import | 호출 |
| --- | --- | --- |
| default | `import Behavon from "behavon"` | `Behavon.useState(0)` |
| namespace | `import * as Behavon from "behavon"` | `Behavon.useState(0)` |
| named | `import { useState } from "behavon"` | `useState(0)` |

[Lint 규칙](./lint.md)을 쓰면 default·namespace import의 이름은 `Behavon`이어야 합니다.

## 첫 Model

Model은 Hook을 부르고 값을 반환하는 함수입니다. 바깥에서 부를 명령은 [`createPort`](./api/createPort.md)로 선언하고, [`useSignal`](./api/useSignal.md)로 구현한 뒤 [`useExport`](./api/useExport.md)로 엽니다.

```ts
import Behavon, { type Model, type Signal } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

export const Counter: Model<undefined, number, CounterPort> = () => {
  const [count, setCount] = Behavon.useState(0)
  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}
```

[`createModel`](./api/createModel.md)로 실행하면 instance가 생기고, 연 Signal을 instance에서 부를 수 있습니다.

```ts
const counter = Behavon.createModel(Counter, undefined)
counter.increment()
```

## React에 연결하기

Model은 React 밖에서 실행됩니다. React에 보여 줄 값은 [`useSnapshot`](./api/useSnapshot.md)으로 발행하고, React는 [`subscribe` / `getSnapshot`](./api/subscribe.md)을 `useSyncExternalStore`에 넘겨 읽습니다. 클라이언트 렌더링만 지원합니다([지원 범위](./core-concepts.md#지원-범위)).

```ts
import Behavon, { type Model, type Signal, type SnapshotRootId } from "behavon"

interface CounterPort {
  count: SnapshotRootId<number>
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({
  count: Behavon.SnapshotType(),
  increment: Behavon.SignalType(),
})

export const Counter: Model<undefined, number, CounterPort> = () => {
  const countId = Behavon.useExport(counterPort, "count")
  const [count, setCount] = Behavon.useState(0)
  const [, publish] = Behavon.useSnapshot(countId)
  Behavon.useEffect(() => publish(count), [count, publish])

  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}
```

```tsx
import { useSyncExternalStore } from "react"

const counter = Behavon.createModel(Counter, undefined)

function CounterButton() {
  const count = useSyncExternalStore(
    Behavon.subscribe(counter.count),
    Behavon.getSnapshot(counter.count),
  )
  return <button onClick={() => counter.increment()}>{count}</button>
}
```

다음으로 [주요 개념](./core-concepts.md)을 읽어 보세요.
