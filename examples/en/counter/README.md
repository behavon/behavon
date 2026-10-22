# Counter

Counts up and down, adds any amount, and resets to the starting value.

## What it shows

- Managing a value with [`useState`](../../../docs/en/api/useState.md)
- Declaring the snapshot and Signals to expose with [`createPort`](../../../docs/en/api/createPort.md) and opening them with [`useExport`](../../../docs/en/api/useExport.md)
- Publishing the values the screen needs (`count`, `isZero`) at once with [`useSnapshot`](../../../docs/en/api/useSnapshot.md)
- React reads them with [`subscribe` / `getSnapshot`](../../../docs/en/api/subscribe.md), and the buttons call only the exposed Signals

## Files

| File | Role |
| --- | --- |
| [counter.ts](./counter.ts) | The `Counter` Model and `CounterPort`. Its input is the starting value. |
| [counter-view.tsx](./counter-view.tsx) | The `CounterView` React component. It receives a `TypedModelRef<CounterPort>`. |
| [counter.test.ts](./counter.test.ts) | Checks that each command changes the snapshot. |
| [counter-view.test.tsx](./counter-view.test.tsx) | Checks that pressing buttons on screen changes the value. |

## Usage

```tsx
const counter = Behavon.createModel(Counter, 0)
root.render(<CounterView counter={counter} />)
// after unmounting the screen
counter.dispose()
```
