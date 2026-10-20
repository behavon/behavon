# `useSnapshot(id)`

Model이 바깥에 보여 줄 값(snapshot)을 발행합니다. 현재 값과 발행 함수를 반환합니다.

```ts
function useSnapshot<Value>(id: SnapshotRootId<Value>): readonly [current: Value | undefined, publish: Publish]
```

- `id`: [`createId`](./createId.md)로 만든 snapshot id. 하위 항목이 아니라 맨 위 id를 넘깁니다.
- `current`: 지금 발행된 값. 아직 발행하지 않았으면 `undefined`입니다.

`publish`는 다음처럼 씁니다.

| 호출 | 하는 일 |
| --- | --- |
| `publish(value)` | 맨 위 항목에 값을 발행합니다. |
| `publish(previous => next)` | 맨 위 항목의 현재 값으로 다음 값을 계산해 발행합니다. |
| `publish(id.child, value)` | 하위 항목 하나에만 발행합니다. |
| `publish(id.child, previous => next)` | 하위 항목의 현재 값으로 다음 값을 계산해 발행합니다. |

- 발행한 값이 현재 값과 `Object.is`로 같으면 아무 일도 일어나지 않습니다. 다르면 값을 바꾸고 그 항목의 구독자를 바로 호출합니다.
- 하위 항목에 발행해도 맨 위나 다른 하위 항목의 구독자는 호출되지 않습니다.
- `publish`는 [`useEffect`](./useEffect.md)나 callback 안에서 호출합니다. 개발 모드에서는 Model 본문에서 호출하면 경고를 출력합니다.
- 바깥에서는 [`subscribe` / `getSnapshot`](./subscribe.md)으로 읽습니다.
- 같은 id를 여러 instance가 쓰면 하나의 snapshot을 함께 쓰고, 마지막에 발행한 값이 남습니다. instance마다 따로 두려면 id를 [`useExport`](./useExport.md)로 만듭니다.
- 이 id를 쓰는 Model이 모두 종료되면 snapshot도 사라집니다.

## 예제

```ts
const weather = Behavon.createId({
  $: Behavon.SnapshotType<{ readonly city: string }>(),
  temperature: Behavon.SnapshotType<number>(),
})

function Weather(city: string): undefined {
  const [, publish] = Behavon.useSnapshot(weather)
  Behavon.useEffect(() => {
    publish({ city })
    publish(weather.temperature, 21)
    publish(weather.temperature, previous => (previous ?? 0) + 1)
  }, [city, publish])
  return undefined
}

const seoul = Behavon.createModel(Weather, "Seoul")
Behavon.getSnapshot(weather)() // { city: "Seoul" }
Behavon.getSnapshot(weather.temperature)() // 22
```
