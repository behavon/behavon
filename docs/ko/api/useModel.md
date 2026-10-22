# `useModel(instance)`

다른 instance의 결과값을 읽고, 그 instance의 input을 바꾸는 함수를 함께 받습니다.

```ts
function useModel<Input, Output>(
  instance: ModelInstance<Input, Output>,
): readonly [output: Output, setInput: StateSetter<Input>]
```

## 인자

- `instance`: [`createModel`](./createModel.md)이 반환한 instance.

## 반환값

- `output`: 대상이 마지막으로 확정한 결과값.
- `setInput(next)` / `setInput(previous => next)`: 대상의 input을 바꿉니다. 대상은 다음 microtask에 다시 평가됩니다.

## 동작

- 대상의 결과값이 바뀌면 이 Model도 다시 평가됩니다.
- 대상을 소유하지 않습니다. 관찰을 그만둬도 대상은 살아 있고, 끝내려면 대상의 `dispose()`를 부릅니다.
- 대상이 종료되면 이 Model도 종료됩니다([오류와 종료](../core-concepts.md#오류와-종료)).
- 자기 자신이나 서로를 관찰하는 순환은 오류입니다.

## 예제

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
// counter의 결과값은 1, doubled의 결과값은 2가 됩니다
```
