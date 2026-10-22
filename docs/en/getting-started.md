# Getting started

## Installation

```sh
npm install behavon
```

## import

All three forms import the same functions. These docs use the default import.

| Form | import | Call |
| --- | --- | --- |
| default | `import Behavon from "behavon"` | `Behavon.useState(0)` |
| namespace | `import * as Behavon from "behavon"` | `Behavon.useState(0)` |
| named | `import { useState } from "behavon"` | `useState(0)` |

With the [lint rules](./lint.md), the name of a default or namespace import must be `Behavon`.

## A first Model

A Model is a function that calls Hooks and returns a value. A command callable from outside is declared with [`createPort`](./api/createPort.md), implemented with [`useSignal`](./api/useSignal.md), and opened with [`useExport`](./api/useExport.md).

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

Running it with [`createModel`](./api/createModel.md) creates an instance, and the opened Signal can be called on the instance.

```ts
const counter = Behavon.createModel(Counter, undefined)
counter.increment()
```

## Connecting to React

A Model runs outside React. A value to show in React is published with [`useSnapshot`](./api/useSnapshot.md), and React reads it by passing [`subscribe` / `getSnapshot`](./api/subscribe.md) to `useSyncExternalStore`. Only client rendering is supported ([supported environment](./core-concepts.md#supported-environment)).

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

Next, read the [core concepts](./core-concepts.md).
