# `subscribe(id)` / `getSnapshot(id)`

[`useSnapshot`](./useSnapshot.md)으로 발행된 값을 Model 밖에서 읽습니다. 두 함수는 React의 `useSyncExternalStore`에 그대로 넘길 함수를 반환합니다.

```ts
function subscribe<Value>(id: SnapshotId<Value>): (listener: () => void) => () => void
function getSnapshot<Value>(id: SnapshotId<Value>): () => Value | undefined
```

## 인자

- `id`: 맨 위 snapshot id나 하위 항목 id. `$`가 없는 중간 객체는 넘길 수 없습니다.

## 반환값

- `subscribe(id)`: listener를 등록하는 함수. 그 항목의 값이 바뀔 때마다 listener를 부르고, 해제 함수를 반환합니다.
- `getSnapshot(id)`: 그 항목의 지금 값을 읽는 함수. 아직 발행하지 않았으면 `undefined`입니다.

## 동작

- 같은 id로 부르면 같은 함수를 반환하므로, 렌더링마다 다시 구독되지 않습니다.
- 그 id를 발행하는 Model이 살아 있을 때만 쓸 수 있습니다. React 화면을 먼저 내린 뒤 Model을 `dispose()`하세요.
- 서버 렌더링용 `getServerSnapshot`은 제공하지 않습니다([지원 범위](../core-concepts.md#지원-범위)).

## 예제

```tsx
import { useSyncExternalStore } from "react"

const temperature = Behavon.createId(Behavon.SnapshotType<number>())

function Thermometer(celsius: number): undefined {
  const [, publish] = Behavon.useSnapshot(temperature)
  Behavon.useEffect(() => {
    publish(celsius)
  }, [celsius, publish])
  return undefined
}

const thermometer = Behavon.createModel(Thermometer, 21)

function TemperatureView() {
  const celsius = useSyncExternalStore(
    Behavon.subscribe(temperature),
    Behavon.getSnapshot(temperature),
  )
  return <p>{celsius}°C</p>
}
```
