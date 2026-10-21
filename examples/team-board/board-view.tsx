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
    <nav aria-label="팀원">
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
    <section aria-label="할 일">
      <form onSubmit={(event) => { event.preventDefault(); board.add(title); setTitle(""); }}>
        <input aria-label="새 할 일" value={title} onChange={(event) => setTitle(event.target.value)} />
        <button type="submit" disabled={title.trim() === "" || view.loading}>
          {view.assignee === undefined ? "추가" : `${view.assignee.name}에게 추가`}
        </button>
      </form>
      <button type="button" disabled={view.loading} onClick={() => board.load()}>불러오기</button>
      {view.loading && <p role="status">저장 중…</p>}
      {view.error !== undefined && <p role="alert">{view.error}</p>}
      <ul>
        {view.tasks.map((task) => (
          <li key={task.id}>
            <label>
              <input type="checkbox" checked={task.completed} onChange={() => board.toggle(task.id)} />
              {task.title}
            </label>
            <span>{task.assignee?.name ?? "담당자 없음"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SummaryBar({ board }: { readonly board: Board }) {
  const view = useView(board.summary);
  if (view === undefined) return null;
  return <p aria-label="진행률">{view.completed}/{view.total} 완료 ({view.progress}%)</p>;
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
