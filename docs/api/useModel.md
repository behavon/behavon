# `useModel(instance)`

다른 Model instance의 최신 결과값과, 그 instance의 input을 바꾸는 함수를 반환합니다.

```ts
function useModel<Input, Output>(
  instance: ModelInstance<Input, Output>,
): readonly [output: Output, setInput: StateSetter<Input>]
```

- `instance`: [`createModel`](./createModel.md)로 만든 instance.
- `output`: 대상이 마지막으로 확정한 결과값.
- `setInput(next)` / `setInput(previous => next)`: 대상의 input을 바꿉니다. 대상은 다음 microtask에 다시 평가됩니다.

대상의 결과값이 바뀌면 이 Model도 다시 평가됩니다. 관찰을 그만둬도 대상 instance는 계속 살아 있습니다. 대상을 끝내려면 대상의 `dispose()`를 호출합니다.

자기 자신을 관찰하거나 서로 관찰하는 순환은 오류입니다. 종료된 instance의 `setInput`을 부르면 오류입니다.

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
```
