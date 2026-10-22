# `usePort(ref)`

Lets a Model use the Signals, Slots, and snapshot ids another instance exposes.

```ts
function usePort<Port>(ref: TypedModelRef<Port>): DependencyProxy<Port>
```

## Parameters

- `ref`: the instance to use, usually received as the Model's input.

## Returns

An object that follows the target's Port.

| Target member | How to use it |
| --- | --- |
| Opened Signal | Call it inside [`useEffect`](./useEffect.md) or a callback, or pass it as the `source` of [`useConnect`](./useConnect.md). |
| Slot | Pass it as the `destination` of `useConnect`. It cannot be called. |
| Opened snapshot id | Read it. |

## Behavior

- It does not observe the target. When the target's result changes, this Model is not evaluated again. Use [`useModel`](./useModel.md) to read the result.
- Taking out a Signal the target has not opened is an error.

## Example

`AutoIncrement` calls the `increment` of the `counter` it receives as input every second.

```ts
import Behavon, { type Model, type Signal, type TypedModelRef } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

const Counter: Model<undefined, number, CounterPort> = () => {
  const [count, setCount] = Behavon.useState(0)
  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

function AutoIncrement(target: TypedModelRef<CounterPort>): undefined {
  const counter = Behavon.usePort(target)
  Behavon.useEffect(() => {
    const timer = setInterval(() => counter.increment(), 1000)
    return () => clearInterval(timer)
  }, [counter])
  return undefined
}

const counter = Behavon.createModel(Counter, undefined)
const autoIncrement = Behavon.createModel(AutoIncrement, counter)
// counter's result: 0 at first, then up by 1 every second
```
