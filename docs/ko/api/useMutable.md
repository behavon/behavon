# `useMutable(initial)`

다시 평가를 일으키지 않는 값을 담는 handle을 반환합니다. 화면에 보일 필요가 없는 값을 기억할 때 씁니다.

```ts
function useMutable<State>(initial: State): {
  get(): State
  set(update: State | ((previous: State) => State)): void
}
```

## 인자

- `initial`: 처음 값. 함수를 넘겨도 부르지 않고 함수 자체를 담습니다.

## 반환값

handle. 항상 같은 객체입니다.

- `get()`: 지금 값을 읽습니다.
- `set(next)` / `set(previous => next)`: 값을 바로 바꿉니다. 함수를 담으려면 `set(() => fn)`처럼 감쌉니다.

## 동작

- `set`은 Model을 다시 평가하지 않습니다.
- handle은 그 Model의 상태를 가리킵니다. Model이 종료된 뒤 쓰면 오류입니다.

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
