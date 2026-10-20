# `useMemo(factory, dependencies)`

React의 `useMemo`와 같습니다. dependency가 바뀔 때만 값을 다시 계산합니다.

```ts
function useMemo<Value>(factory: () => Value, dependencies: readonly unknown[]): Value
```

- `factory`: 값을 계산하는 함수.
- `dependencies`: 이 값들이 이전과 `Object.is`로 모두 같으면 이전 값을 그대로 씁니다. 생략할 수 없습니다.

배열의 길이가 이전과 달라지면 오류입니다. `factory` 안에서 Hook을 부르면 오류입니다.

## 예제

```ts
function Report(items: readonly number[]): number {
  const total = Behavon.useMemo(() => items.reduce((sum, n) => sum + n, 0), [items])
  return total
}

const report = Behavon.createModel(Report, [1, 2, 3])
// 결과값: 6
```
