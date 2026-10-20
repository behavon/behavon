# `useExport`

Model 밖에서 쓸 수 있도록 값이나 Signal을 instance에 공개합니다. 공개한 이름은 바깥에서 `instance.name`으로, 다른 Model에서 [`usePort`](./usePort.md) 결과로 씁니다.

```ts
function useExport<Port>(port: PortDescriptor<Port>, name: keyof Port): Port[typeof name]
function useExport<Port>(port: PortDescriptor<Port>, name: keyof Port, existing: SnapshotRootId<unknown>): Port[typeof name]
function useExport<Exports extends Record<string, unknown>>(initialize: () => Exports): Readonly<Exports>
```

## 형태별 용법

| 호출 | 하는 일 |
| --- | --- |
| `useExport(port, snapshotName)` | [`createPort`](./createPort.md)의 `SnapshotType()` 항목: 이 instance만의 snapshot id를 새로 만들어 공개하고 반환합니다. |
| `useExport(port, snapshotName, existing)` | 같은 항목에 이미 있는 snapshot id `existing`을 공개하고 반환합니다. 다른 Model의 snapshot id를 다시 공개할 때 씁니다. |
| `useExport(port, signalName)` | `SignalType()` 항목: [`useSignal(port, signalName, callback)`](./useSignal.md)로 만든 Signal을 공개하고 반환합니다. `useSignal`보다 먼저 부르면 오류입니다. |
| `useExport(() => ({ ... }))` | Port 없이, 넘긴 함수가 반환한 객체의 각 key를 공개합니다. 넘긴 함수는 처음 한 번만 호출합니다. |

## 규칙

- Port에 선언한 snapshot 항목과 Signal 항목은 모두 `useExport`로 공개해야 합니다. 빠뜨리면 Model을 만들 때 오류입니다.
- Port를 쓰는 Model에서 Port 없는 형태로 다른 이름을 공개하면 오류입니다.
- Port 없는 형태로는 함수를 공개할 수 없습니다. Signal도 함수이므로 넣으면 오류입니다.
- 공개한 값은 처음 공개한 값으로 고정됩니다. 다시 평가해도 바뀌지 않습니다.
- 공개 이름은 Signal·Slot 이름과 같은 공간을 씁니다. 같은 이름을 함께 쓰면 오류입니다.
- 공개한 값을 읽어도 Model을 관찰하는 것은 아닙니다. 바뀌는 결과값은 [`useModel`](./useModel.md)이나 [`useSnapshot`](./useSnapshot.md)으로 읽습니다.

## 예제

Port를 쓰는 예제는 [`createPort`](./createPort.md)와 [`useSignal`](./useSignal.md)을 보세요. Port 없이 쓰면 다음과 같습니다.

```ts
function Counter(): number {
  const ids = Behavon.useExport(() => ({
    count: Behavon.createId(Behavon.SnapshotType<number>()),
  }))
  const [count] = Behavon.useState(0)
  const [, publish] = Behavon.useSnapshot(ids.count)
  Behavon.useEffect(() => publish(count), [count, publish])
  return count
}

const counter = Behavon.createModel(Counter, undefined)
const readCount = Behavon.getSnapshot(counter.count)
readCount() // 0
```
