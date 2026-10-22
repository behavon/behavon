# Core concepts

Behavon writes logic outside React with React Hook syntax. React handles the screen; Models handle state and behavior.

## Model

A Model is a function that calls Hooks and returns a value. As a React component returns JSX, a Model returns its result.

```ts
function Counter(): number {
  const [count] = Behavon.useState(0)
  return count
}
```

When state changes, the Model is evaluated again, just as a component re-renders. The Hook rules are the same as React's: always call them in the same order, and only at the top level of the function.

## Instance

A Model becomes a live instance only when run with [`createModel`](./api/createModel.md). The instance lives until `dispose()` is called.

```ts
const counter = Behavon.createModel(Counter, undefined)
counter.dispose()
```

Instances are linked in two ways.

- [`useModel`](./api/useModel.md): reads another instance's result and is evaluated again when that value changes.
- [`usePort`](./api/usePort.md): uses the Signals, Slots, and snapshot ids another instance exposes.

A Model receives the instances it needs as its input. There is no implicit injection such as `useContext`.

## Port

[`createPort`](./api/createPort.md) declares the names and types a Model exposes. It can declare three kinds of members.

| Member | Role | Hook that fills it |
| --- | --- | --- |
| `Signal` | A command called from outside, or an event that notifies connected Slots | [`useSignal`](./api/useSignal.md) + [`useExport`](./api/useExport.md) |
| `Slot` | A place that receives another Model's Signal | [`useSlot`](./api/useSlot.md) |
| `SnapshotRootId` | The identifier of a value read from outside, such as by React | [`useExport`](./api/useExport.md) |

On an instance, opened Signals and snapshot ids are used by name (`counter.increment()`, `counter.count`). Slots cannot be called on an instance; another Model takes them out with `usePort` and connects them.

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

## Signal and Slot

Calling a Signal runs that Signal's function and passes the same arguments to the Slots connected with [`useConnect`](./api/useConnect.md). All of it runs synchronously, right there. If the function changes state, the Model is evaluated again in the next microtask.

## Snapshot

A snapshot is a value a Model shows to the outside, such as React. The Model publishes it with [`useSnapshot`](./api/useSnapshot.md), and the outside reads it with [`subscribe` / `getSnapshot`](./api/subscribe.md).

## Errors and termination

| Where the error happens | Result |
| --- | --- |
| A Signal or Slot function throws | The error is thrown right away to the caller of that Signal. The Model is not terminated. |
| A Signal or Slot function returns a Promise that rejects | It becomes an async error with no receiver (`unhandledRejection`). |
| The first evaluation or the first Effect | `createModel` throws the error and no instance is created. |
| Evaluating again after a state change, or an Effect after that | The Model is terminated, and the error is reported the way React reports a render error it could not handle (`reportError`, otherwise an `error` event, and in Node the `uncaughtException` event of `process`). The Signal that changed the state returns normally. |
| The evaluation of [`transaction.commit`](./api/transaction.md) | The Model is terminated and `commit` throws the error. |

When a Model is terminated (by an error or by `dispose()`):

- Effect cleanup functions run, external store subscriptions are released, Resources are `abort`ed, and running Futures are cancelled.
- The connections that Model sent or received are disconnected.
- Models that read it with `useModel` are terminated too: with the same error if the target was terminated by an error, or with a `disposed during model observation` error if it was `dispose()`d. Each is reported in the way above.
- Calling a Signal of a terminated instance, or passing it to `useModel`, `usePort`, or `getInterface`, is an error. A `useState` setter of a terminated Model does nothing.

## Supported environment

**Server rendering (SSR) and hydration are not supported.** [`subscribe` / `getSnapshot`](./api/subscribe.md) provide no value for `getServerSnapshot`, the third argument of `useSyncExternalStore`.
