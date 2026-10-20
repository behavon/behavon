# `useState(initial?)`

React의 `useState`와 같습니다. 현재 값과 값을 바꾸는 setter를 반환합니다.

```ts
function useState<State>(): readonly [State | undefined, StateSetter<State | undefined>]
function useState<State>(initial: State | (() => State)): readonly [State, StateSetter<State>]
```

- 인자 없이 부르면 처음 값은 `undefined`입니다.
- `initial`에 값을 넘기면 그 값이 처음 값입니다.
- `initial`에 함수를 넘기면 처음 한 번만 호출해 그 결과를 처음 값으로 씁니다.

Setter는 다음처럼 씁니다.

- `setValue(next)`: 값으로 바꿉니다.
- `setValue(previous => next)`: 이전 값으로 다음 값을 계산합니다. 여러 번 호출하면 호출 순서대로 적용됩니다.
- Setter는 항상 같은 함수입니다.
- 값이 바뀌면 Model이 다음 microtask에 다시 평가됩니다. 마지막 값이 이전 값과 `Object.is`로 같으면 바뀐 것으로 보지 않습니다.
- Model 본문에서 자기 setter를 부르면 그 자리에서 바로 다시 평가합니다. 25번을 넘게 반복하면 오류입니다.
- 종료된 Model의 setter를 부르면 아무 일도 일어나지 않습니다.

## 예제

```ts
function Counter(): string {
  const [count, setCount] = Behavon.useState(0)
  const [label] = Behavon.useState<string>()
  const [items] = Behavon.useState(() => [1, 2, 3])
  Behavon.useEffect(() => {
    setCount(1)
    setCount(n => n + 1)
  }, [setCount])
  return `${label ?? "count"}: ${count + items.length}`
}

const counter = Behavon.createModel(Counter, undefined)
// 결과값: 처음 "count: 3", Effect의 setter가 적용된 뒤 "count: 5"
```

결과값은 다른 Model에서 [`useModel`](./useModel.md)로 읽습니다.
