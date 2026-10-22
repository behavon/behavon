# 카운터

숫자를 올리고 내리고, 원하는 만큼 더하고, 처음 값으로 되돌립니다.

## 보여 주는 기능

- [`useState`](../../../docs/ko/api/useState.md)로 값 관리
- [`createPort`](../../../docs/ko/api/createPort.md)로 공개할 snapshot과 Signal을 선언하고 [`useExport`](../../../docs/ko/api/useExport.md)로 공개
- 화면에 필요한 값(`count`, `isZero`)을 [`useSnapshot`](../../../docs/ko/api/useSnapshot.md)으로 한 번에 발행
- React는 [`subscribe` / `getSnapshot`](../../../docs/ko/api/subscribe.md)으로 읽고, 버튼은 공개 Signal만 호출

## 구성

| 파일 | 역할 |
| --- | --- |
| [counter.ts](./counter.ts) | `Counter` Model과 `CounterPort`. input은 처음 값입니다. |
| [counter-view.tsx](./counter-view.tsx) | `CounterView` React 컴포넌트. `TypedModelRef<CounterPort>`를 받습니다. |
| [counter.test.ts](./counter.test.ts) | 명령마다 snapshot이 바뀌는지 확인합니다. |
| [counter-view.test.tsx](./counter-view.test.tsx) | 화면에서 버튼을 눌러 값이 바뀌는지 확인합니다. |

## 사용

```tsx
const counter = Behavon.createModel(Counter, 0)
root.render(<CounterView counter={counter} />)
// 화면을 내린 뒤
counter.dispose()
```
