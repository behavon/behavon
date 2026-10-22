# `useReducer(reducer, initialArg, init?)`

The same as React's `useReducer`. Returns the current state and a `dispatch` that sends actions.

```ts
function useReducer<State, Action>(
  reducer: (state: State, action: Action) => State,
  initialState: State,
): readonly [State, (action: Action) => void]

function useReducer<State, InitialArg, Action>(
  reducer: (state: State, action: Action) => State,
  initialArg: InitialArg,
  init: (initialArg: InitialArg) => State,
): readonly [State, (action: Action) => void]
```

## Parameters

- `reducer`: computes the next state from the current state and an action. `(state) => next` without an action also works, and is then called with `dispatch()`.
- `initialState`: the first state.
- `init`: if passed, `init(initialArg)` is called once at first and used as the first state.

## Returns

- The current state.
- `dispatch(action)`: always the same function.

## Behavior

- Sent actions are processed in the order sent, and the Model is evaluated again in the next microtask. If the resulting state is the same as before by `Object.is`, that evaluation is not committed: the result stays the same and no Effect runs.

## Example

```ts
type Action = { readonly type: "add"; readonly amount: number } | { readonly type: "reset" }

function reducer(state: number, action: Action): number {
  return action.type === "add" ? state + action.amount : 0
}

function Total(): number {
  const [total, dispatch] = Behavon.useReducer(reducer, 0)
  const [ticks, tick] = Behavon.useReducer((n: number) => n + 1, 10, (start: number) => start * 2)
  Behavon.useEffect(() => {
    dispatch({ type: "add", amount: 5 })
    tick()
  }, [dispatch, tick])
  return total + ticks
}

const totalModel = Behavon.createModel(Total, undefined)
// result: 20 (0 + 10 * 2) at first, then 26 (5 + 21) after the Effect's dispatches apply
```
