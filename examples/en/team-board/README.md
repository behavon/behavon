# Team board

Manages members and tasks separately, and makes the selected member the assignee of new tasks. Tasks are saved to a server.

## What it shows

- Assembling several Models with [`createModel`](../../../docs/en/api/createModel.md) and passing them to each other as input
- Connecting the `selected` Signal that Members declares in its Port and opens to a Slot of Tasks with [`useConnect`](../../../docs/en/api/useConnect.md)
- A derived Model: Summary observes the result of Tasks with [`useModel`](../../../docs/en/api/useModel.md) and computes the progress
- Notifying the outside of reports (`reportTo`) with [`useEffect`](../../../docs/en/api/useEffect.md), running the cleanup before the next report and on termination
- Async commands that go through a server, keeping whether one is in progress and its error as state and showing them through snapshots
- The screen receives only the Board, which re-exposes three snapshot ids with [`useExport`](../../../docs/en/api/useExport.md)

## Files

| File | Role |
| --- | --- |
| [members.ts](./members.ts) | `Members`. The member list and selection. Selecting notifies Tasks through `selected`. |
| [tasks.ts](./tasks.ts) | `Tasks`. Tasks, assignee, in-progress flag, and error. Adding and loading go through a `TaskTransport`. |
| [summary.ts](./summary.ts) | `Summary`. Computes the total, completed count, and progress from the result of Tasks. |
| [board.ts](./board.ts) | `Board` and the assembly function `createTeamBoard`. Cleanup runs in the reverse order of creation. |
| [board-view.tsx](./board-view.tsx) | The member, task, and progress components. |
| [fake-transport.ts](./fake-transport.ts) | An in-memory server for tests and the demo. It can hold responses or make them fail. |
| [team-board.test.ts](./team-board.test.ts) | Checks assignment, in-progress and error state, loading, progress, report cleanup, and termination. |
| [board-view.test.tsx](./board-view.test.tsx) | Checks selecting a member, adding, completing, and progress on screen. |

```text
React ──command──▶ Board ──▶ Members ──selected (Signal)──▶ Tasks.memberSelected (Slot)
                       └───▶ Tasks ──result──▶ Summary (useModel)
```

## Note

A callback registered on a Signal uses the values of the last committed evaluation. If you select a member and call `add` right away in the same flow, the previous assignee is used because the Model has not been evaluated again yet. This is the same as a React event handler using the values of the previous render.

## Usage

```tsx
const team = createTeamBoard({ members, transport })
root.render(<BoardView board={team.board} />)
// after unmounting the screen
team.dispose()
```
