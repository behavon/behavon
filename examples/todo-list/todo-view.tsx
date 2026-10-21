import { useSyncExternalStore } from "react";
import Behavon, { type SnapshotId, type TypedModelRef } from "behavon";
import type { TodoAppPort } from "./todo-app";
import type { Filter } from "./todo-domain";

type TodoApp = TypedModelRef<TodoAppPort>;

function useView<Value>(id: SnapshotId<Value>): Value | undefined {
  return useSyncExternalStore(Behavon.subscribe(id), Behavon.getSnapshot(id));
}

function TodoInput({ app }: { readonly app: TodoApp }) {
  const input = useView(app.view.input);
  if (input === undefined) return null;
  return (
    <form onSubmit={(event) => { event.preventDefault(); app.submit(); }}>
      <input aria-label="할 일" value={input.draft} onChange={(event) => app.setDraft(event.target.value)} />
      <button type="submit" disabled={!input.canSubmit}>추가</button>
    </form>
  );
}

function TodoItems({ app }: { readonly app: TodoApp }) {
  const list = useView(app.view);
  if (list === undefined) return null;
  return (
    <ul>
      {list.items.map((item) => (
        <li key={item.id}>
          <label>
            <input type="checkbox" checked={item.completed} onChange={() => app.toggle(item.id)} />
            {item.text}
          </label>
          <button type="button" aria-label={`${item.text} 삭제`} onClick={() => app.remove(item.id)}>×</button>
        </li>
      ))}
    </ul>
  );
}

const filters: readonly { readonly value: Filter; readonly label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "남은 일" },
  { value: "completed", label: "완료" },
];

function TodoFooter({ app }: { readonly app: TodoApp }) {
  const footer = useView(app.view.footer);
  if (footer === undefined) return null;
  return (
    <footer>
      <span>{footer.remaining}개 남음</span>
      {filters.map(({ value, label }) => (
        <button key={value} type="button" aria-pressed={footer.filter === value} onClick={() => app.setFilter(value)}>
          {label}
        </button>
      ))}
      <button type="button" disabled={footer.completed === 0} onClick={() => app.clearCompleted()}>완료 항목 정리</button>
    </footer>
  );
}

export function TodoView({ app }: { readonly app: TodoApp }) {
  return (
    <section>
      <TodoInput app={app} />
      <TodoItems app={app} />
      <TodoFooter app={app} />
    </section>
  );
}
