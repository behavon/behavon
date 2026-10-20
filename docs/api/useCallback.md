# `useCallback(callback, dependencies)`

React의 `useCallback`과 같습니다. dependency가 바뀔 때만 새 함수를 반환합니다.

```ts
function useCallback<Callback extends Function>(callback: Callback, dependencies: readonly unknown[]): Callback
```

- `callback`: 기억할 함수.
- `dependencies`: 이 값들이 이전과 `Object.is`로 모두 같으면 이전 함수를 그대로 반환합니다. 생략할 수 없습니다.

반환된 함수는 넘긴 함수와 다른 객체이지만 똑같이 호출됩니다. `this`와 인자도 그대로 전달됩니다. [`useSignal`](./useSignal.md)과 [`useSlot`](./useSlot.md)에는 같은 Model에서 `useCallback`으로 만든 함수만 넘길 수 있습니다. 배열의 길이가 이전과 달라지면 오류입니다.

## 예제

```ts
function Greeter(name: string): string {
  const greet = Behavon.useCallback(() => `hello, ${name}`, [name])
  return greet()
}

const greeter = Behavon.createModel(Greeter, "Kim")
// 결과값: "hello, Kim"
```
