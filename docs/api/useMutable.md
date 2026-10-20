# `useMutable(initial)`

React의 `useRef`에 해당합니다. 값을 담아 두는 handle을 반환합니다.

```ts
function useMutable<State>(initial: State): {
  get(): State
  set(update: State | ((previous: State) => State)): void
}
```

- `initial`: 처음 값. 함수를 넘겨도 호출하지 않고 함수 자체를 저장합니다.
- `get()`: 지금 값을 읽습니다.
- `set(next)`: 값을 바로 바꿉니다.
- `set(previous => next)`: 이전 값으로 다음 값을 계산합니다. 함수 자체를 저장하려면 `set(() => fn)`처럼 감쌉니다.

`set`은 Model을 다시 평가하지 않습니다. 화면에 보일 필요가 없는 값을 기억할 때 씁니다. handle은 항상 같은 객체이고, `.current`는 없습니다. Model이 종료된 뒤 handle을 쓰면 오류입니다.

## 예제

```ts
function Sender(): number {
  const sent = Behavon.useMutable(0)
  const [, setTick] = Behavon.useState(0)
  Behavon.useEffect(() => {
    sent.set(n => n + 1)
    setTick(sent.get())
  }, [sent, setTick])
  return sent.get()
}

const sender = Behavon.createModel(Sender, undefined)
// 결과값: 처음 0. sent.set만으로는 다시 평가되지 않고, setTick이 다시 평가하게 한 뒤 1
```
