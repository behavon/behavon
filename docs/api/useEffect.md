# `useEffect(effect, dependencies?)`

React의 `useEffect`와 같습니다. 평가가 확정된 뒤 실행할 작업을 등록합니다.

```ts
function useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void
```

## 인자

- `effect`: 실행할 작업. 함수를 반환하면 다음 실행 전과 Model 종료 때 정리 함수로 부릅니다.
- `dependencies`: 생략하면 평가가 확정될 때마다, `[]`이면 처음 한 번만, `[a, b]`이면 값이 `Object.is`로 달라졌을 때만 실행합니다. 생략과 배열을 오가거나 길이를 바꾸면 오류입니다.

## 동작

- 첫 실행은 [`createModel`](./createModel.md)이 반환하기 전에 끝납니다.
- snapshot 발행, Signal 호출, 네트워크 요청처럼 바깥에 영향을 주는 작업은 Model 본문이 아니라 여기서 합니다.

## 예제

```ts
function Clock(): number {
  const [now, setNow] = Behavon.useState(0)
  Behavon.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [setNow])
  return now
}

const clock = Behavon.createModel(Clock, undefined)
// 결과값: 처음 0, 1초마다 그 시점의 Date.now()
// clock.dispose()를 부르면 정리 함수가 clearInterval을 부릅니다
```
