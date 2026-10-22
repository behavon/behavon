# `useState(initial?)`

React의 `useState`와 같습니다. 현재 값과, 값을 바꾸고 Model을 다시 평가하게 하는 setter를 반환합니다.

```ts
function useState<State>(): readonly [State | undefined, StateSetter<State | undefined>]
function useState<State>(initial: State | (() => State)): readonly [State, StateSetter<State>]
```

## 인자

- `initial`: 처음 값. 생략하면 `undefined`이고, 함수를 넘기면 처음 한 번만 불러 그 결과를 씁니다.

## 반환값

- 현재 값.
- setter: `setValue(next)` 또는 `setValue(previous => next)`. 항상 같은 함수입니다.

## 동작

- setter를 부르면 Model이 다음 microtask에 다시 평가됩니다. 여러 번 부르면 부른 순서대로 적용됩니다. 결과가 이전 값과 `Object.is`로 같으면 그 평가는 확정되지 않습니다. 결과값은 그대로이고 Effect도 실행되지 않습니다.
- Model 본문에서 자기 setter를 부르면 그 자리에서 다시 평가합니다. 25번을 넘게 반복하면 오류입니다.
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
