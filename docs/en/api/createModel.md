# `createModel(model, initialInput)`

Runs a Model and creates a live instance.

```ts
function createModel<Input, Output, Port>(
  model: Model<Input, Output, Port>,
  initialInput: Input,
): ModelInstance<Input, Output, Port>
```

## Parameters

- `model`: the Model to run. A function defined at module top level.
- `initialInput`: the input the Model receives first.

## Returns

An instance.

- Opened Signals and snapshot ids from [`useExport`](./useExport.md) are used by name (`counter.increment()`, `counter.count`).
- It can be passed to another Model's [`useModel`](./useModel.md) or [`usePort`](./usePort.md).
- `dispose()` terminates it. Calling it twice is an error.

The Model's result is not read from the instance. Another Model reads it with `useModel`, and React reads values published with [`useSnapshot`](./useSnapshot.md).

## Behavior

- Returns after the first evaluation and the first run of [`useEffect`](./useEffect.md). If an error happens in between, it throws that error and no instance remains.
- Cannot be called while a Model is being evaluated.

## Example

```ts
import Behavon, { type Model, type Signal } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

const Counter: Model<number, number, CounterPort> = (start) => {
  const [count, setCount] = Behavon.useState(start)
  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

const counter = Behavon.createModel(Counter, 10)
counter.increment()
counter.dispose()
```
