# `useSnapshot(id)`

Publishes a value (a snapshot) that the Model shows to the outside.

```ts
function useSnapshot<Value>(id: SnapshotRootId<Value>): readonly [current: Value | undefined, publish: Publish]
```

## Parameters

- `id`: a snapshot id made with [`createId`](./createId.md) or [`useExport`](./useExport.md). Pass the root id, not a child.

## Returns

- `current`: the value published now. `undefined` if nothing has been published yet.
- `publish`:

| Call | What it does |
| --- | --- |
| `publish(value)` / `publish(previous => next)` | Publishes to the root. |
| `publish(id.child, value)` / `publish(id.child, previous => next)` | Publishes to one child only. |

## Behavior

- If the value differs from the previous one by `Object.is`, it is changed and that member's subscribers are called right away. If it is the same, nothing happens.
- Publishing to a child does not call the subscribers of the root or of other children.
- When several instances use the same id, they share one snapshot and the last published value remains. To keep one per instance, create the id with `useExport`.
- When every Model using this id is terminated, the snapshot is gone too.
- Call `publish` inside [`useEffect`](./useEffect.md) or a callback. In development mode, calling it in the Model body prints a warning.

## Example

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
