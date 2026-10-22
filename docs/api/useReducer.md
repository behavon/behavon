# `useReducer(reducer, initialArg, init?)`

React의 `useReducer`와 같습니다. 현재 state와, action을 보내는 `dispatch`를 반환합니다.

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

## 인자

- `reducer`: 현재 state와 action으로 다음 state를 계산합니다. action이 없는 `(state) => next`도 되고, 그때는 `dispatch()`로 부릅니다.
- `initialState`: 처음 state.
- `init`: 넘기면 처음 한 번만 `init(initialArg)`를 불러 처음 state로 씁니다.

## 반환값

- 현재 state.
- `dispatch(action)`: 항상 같은 함수입니다.

## 동작

- 보낸 action은 보낸 순서대로 처리되고, Model은 다음 microtask에 다시 평가됩니다. 결과 state가 이전과 `Object.is`로 같으면 그 평가는 확정되지 않습니다. 결과값은 그대로이고 Effect도 실행되지 않습니다.

## 예제

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
// 결과값: 처음 20(0 + 10 * 2), Effect의 dispatch가 적용된 뒤 26(5 + 21)
```
