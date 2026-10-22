# `useMemo(factory, dependencies)`

React의 `useMemo`와 같습니다. dependency가 바뀔 때만 값을 다시 계산합니다.

```ts
function useMemo<Value>(factory: () => Value, dependencies: readonly unknown[]): Value
```

## 인자

- `factory`: 값을 계산하는 함수. 안에서 Hook을 부를 수 없습니다.
- `dependencies`: 이전과 `Object.is`로 모두 같으면 이전 값을 씁니다. 생략할 수 없고, 길이를 바꾸면 오류입니다.

## 반환값

계산한 값.

## 예제

```ts
function Report(items: readonly number[]): number {
  const total = Behavon.useMemo(() => items.reduce((sum, n) => sum + n, 0), [items])
  return total
}

const report = Behavon.createModel(Report, [1, 2, 3])
// 결과값: 6
```
