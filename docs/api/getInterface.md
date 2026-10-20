# `getInterface(target)`

Instance에 등록된 Signal·Slot 이름과 등록 수를 반환합니다. 디버깅이나 도구에서 instance의 모양을 확인할 때 씁니다.

```ts
function getInterface(target: ModelInstance | TypedModelRef | DependencyProxy): {
  endpoints: readonly { name: string; signalRegistrations: number; slotRegistrations: number }[]
}
```

- `target`: [`createModel`](./createModel.md)이 반환한 instance나 [`usePort`](./usePort.md) 결과.
- `endpoints`: 등록한 순서대로 나열합니다. `useExport`로 열었는지와 관계없이 등록한 Signal과 Slot을 모두 보여 줍니다. 공개 값은 포함하지 않습니다.

종료된 instance를 넘기면 오류입니다.

## 예제

```ts
function Counter(): number {
  const increment = Behavon.useCallback(() => undefined, [])
  Behavon.useSignal("increment", increment)
  return 0
}

const counter = Behavon.createModel(Counter, undefined)
Behavon.getInterface(counter)
// { endpoints: [{ name: "increment", signalRegistrations: 1, slotRegistrations: 0 }] }
```
