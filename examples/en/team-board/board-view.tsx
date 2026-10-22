import { useState, useSyncExternalStore } from "react";
import Behavon, { type SnapshotId, type TypedModelRef } from "behavon";
import type { BoardPort } from "./board";

type Board = TypedModelRef<BoardPort>;

function useView<Value>(id: SnapshotId<Value>): Value | undefined {
  return useSyncExternalStore(Behavon.subscribe(id), Behavon.getSnapshot(id));
}

function MemberList({ board }: { readonly board: Board }) {
  const view = useView(board.members);
  if (view === undefined) return null;
  return (
    <nav aria-label="Members">
      {view.members.map((member) => (
        <button key={member.id} type="button" aria-pressed={view.selectedId === member.id} onClick={() => board.select(member.id)}>
          {member.name}
        </button>
      ))}
    </nav>
  );
}

function TaskList({ board }: { readonly board: Board }) {
  const view = useView(board.tasks);
  const [title, setTitle] = useState("");
  if (view === undefined) return null;
  return (
    <section aria-label="Tasks">
      <form onSubmit={(event) => { event.preventDefault(); board.add(title); setTitle(""); }}>
        <input aria-label="New task" value={title} onChange={(event) => setTitle(event.target.value)} />
        <button type="submit" disabled={title.trim() === "" || view.loading}>
          {view.assignee === undefined ? "Add" : `Add for ${view.assignee.name}`}
        </button>
      </form>
      <button type="button" disabled={view.loading} onClick={() => board.load()}>Load</button>
      {view.loading && <p role="status">Saving…</p>}
      {view.error !== undefined && <p role="alert">{view.error}</p>}
      <ul>
        {view.tasks.map((task) => (
          <li key={task.id}>
            <label>
              <input type="checkbox" checked={task.completed} onChange={() => board.toggle(task.id)} />
              {task.title}
            </label>
            <span>{task.assignee?.name ?? "Unassigned"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SummaryBar({ board }: { readonly board: Board }) {
  const view = useView(board.summary);
  if (view === undefined) return null;
  return <p aria-label="Progress">{view.completed}/{view.total} done ({view.progress}%)</p>;
}

export function BoardView({ board }: { readonly board: Board }) {
  return (
    <main>
      <MemberList board={board} />
      <TaskList board={board} />
      <SummaryBar board={board} />
    </main>
  );
}
