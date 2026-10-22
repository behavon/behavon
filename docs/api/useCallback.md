# `useCallback(callback, dependencies)`

React의 `useCallback`과 같습니다. dependency가 바뀔 때만 새 함수를 반환합니다.

```ts
function useCallback<Callback extends Function>(callback: Callback, dependencies: readonly unknown[]): Callback
```

## 인자

- `callback`: 기억할 함수.
- `dependencies`: 이전과 `Object.is`로 모두 같으면 이전 함수를 반환합니다. 생략할 수 없고, 길이를 바꾸면 오류입니다.

## 반환값

`callback`을 감싼 함수. 넘긴 함수와 다른 객체이지만 `this`와 인자를 그대로 넘겨 똑같이 동작합니다.

## 동작

- [`useSignal`](./useSignal.md)과 [`useSlot`](./useSlot.md)에는 같은 Model에서 `useCallback`으로 만든 함수만 넘길 수 있습니다.

## 예제

```ts
function Greeter(name: string): string {
  const greet = Behavon.useCallback(() => `hello, ${name}`, [name])
  return greet()
}

const greeter = Behavon.createModel(Greeter, "Kim")
// 결과값: "hello, Kim"
```
