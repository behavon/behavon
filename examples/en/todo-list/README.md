# Todo list

Adds, completes, and deletes tasks, and filters them.

## What it shows

- State transitions with [`useReducer`](../../../docs/en/api/useReducer.md)
- Derived values (remaining count, filtered list) with [`useMemo`](../../../docs/en/api/useMemo.md)
- Publishing the list, footer, and input areas separately as children of [`useSnapshot`](../../../docs/en/api/useSnapshot.md). Typing in the input does not redraw the list or the footer.
- Separating a Domain that holds state from a Presenter that builds screen values; the Domain connects its own Signal to the Presenter's Slot with [`useConnect`](../../../docs/en/api/useConnect.md)
- The screen receives only the App, with the Domain and Presenter hidden. The App forwards commands to the Domain and re-exposes the Presenter's snapshot id with the third argument of [`useExport`](../../../docs/en/api/useExport.md)

## Files

| File | Role |
| --- | --- |
| [todo-domain.ts](./todo-domain.ts) | `TodoDomain`. Changes state with a reducer and sends it to the Presenter with the `changed` Signal on every change. |
| [todo-presenter.ts](./todo-presenter.ts) | `TodoPresenter`. Builds the list, footer, and input values from the received state and publishes only the areas whose values changed. |
| [todo-app.ts](./todo-app.ts) | `TodoApp` and the assembly function `createTodoList`. Cleanup runs in the reverse order of creation. |
| [todo-view.tsx](./todo-view.tsx) | The input, list, and footer components, each subscribing only to its own snapshot. |
| [todo-list.test.ts](./todo-list.test.ts) | Checks commands, per-area notifications, the hidden Models, and cleanup. |
| [todo-view.test.tsx](./todo-view.test.tsx) | Checks adding, completing, filtering, and cleanup on screen. |

```text
React ──command──▶ TodoApp ──command──▶ TodoDomain
  ▲                                       │ changed (Signal)
  │                                       ▼
  └──── snapshot ◀──── TodoPresenter.show (Slot)
```

## Usage

```tsx
const todos = createTodoList(["Buy milk"])
root.render(<TodoView app={todos.app} />)
// after unmounting the screen
todos.dispose()
```
