# `useModel(instance)`

Reads another instance's result, together with a function that changes that instance's input.

```ts
function useModel<Input, Output>(
  instance: ModelInstance<Input, Output>,
): readonly [output: Output, setInput: StateSetter<Input>]
```

## Parameters

- `instance`: an instance returned by [`createModel`](./createModel.md).

## Returns

- `output`: the target's last committed result.
- `setInput(next)` / `setInput(previous => next)`: changes the target's input. The target is evaluated again in the next microtask.

## Behavior

- When the target's result changes, this Model is evaluated again too.
- It does not own the target. The target stays alive after observation stops; call the target's `dispose()` to end it.
- When the target is terminated, this Model is terminated too ([errors and termination](../core-concepts.md#errors-and-termination)).
- Observing itself, or observing each other in a cycle, is an error.

## Example

```ts
function Counter(start: number): number {
  return start
}

const counter = Behavon.createModel(Counter, 0)

function Doubled(): number {
  const [count, setCount] = Behavon.useModel(counter)
  Behavon.useEffect(() => {
    if (count === 0) setCount(previous => previous + 1)
  }, [count, setCount])
  return count * 2
}

const doubled = Behavon.createModel(Doubled, undefined)
// counter's result becomes 1, and doubled's result becomes 2
```
