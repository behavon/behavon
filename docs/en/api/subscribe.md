# `subscribe(id)` / `getSnapshot(id)`

Read values published with [`useSnapshot`](./useSnapshot.md) from outside a Model. Both return functions to pass as is to React's `useSyncExternalStore`.

```ts
function subscribe<Value>(id: SnapshotId<Value>): (listener: () => void) => () => void
function getSnapshot<Value>(id: SnapshotId<Value>): () => Value | undefined
```

## Parameters

- `id`: a root snapshot id or a child id. An intermediate object without `$` cannot be passed.

## Returns

- `subscribe(id)`: a function that registers a listener. It calls the listener whenever that member's value changes and returns a function that removes it.
- `getSnapshot(id)`: a function that reads that member's current value. `undefined` if nothing has been published yet.

## Behavior

- The same id returns the same functions, so rendering does not resubscribe.
- Usable only while a Model publishing that id is alive. Unmount the React screen first, then `dispose()` the Model.
- No `getServerSnapshot` for server rendering is provided ([supported environment](../core-concepts.md#supported-environment)).

## Example

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
