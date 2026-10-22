import Behavon, { type Model, type Slot, type SnapshotId, type SnapshotRootId } from "behavon";
import type { Filter, TodoItem, TodoState } from "./todo-domain";

export interface ListView {
  readonly items: readonly TodoItem[];
}

export interface FooterView {
  readonly remaining: number;
  readonly completed: number;
  readonly filter: Filter;
}

export interface InputView {
  readonly draft: string;
  readonly canSubmit: boolean;
}

/** The list is the root value; the footer and the input are separate child snapshots. */
export type TodoViewId = SnapshotRootId<ListView> & {
  readonly footer: SnapshotId<FooterView>;
  readonly input: SnapshotId<InputView>;
};

export interface TodoPresenterPort {
  view: TodoViewId;
  show: Slot<[state: TodoState]>;
}

const presenterPort = Behavon.createPort<TodoPresenterPort>({
  view: {
    $: Behavon.SnapshotType(),
    footer: Behavon.SnapshotType(),
    input: Behavon.SnapshotType(),
  },
  show: Behavon.SlotType(),
});

function visible(item: TodoItem, filter: Filter): boolean {
  if (filter === "active") return !item.completed;
  if (filter === "completed") return item.completed;
  return true;
}

/**
 * Turns the todo state into what each part of the screen shows.
 * Each part is published only when its own value changes.
 */
export const TodoPresenter: Model<TodoState, undefined, TodoPresenterPort> = (initial) => {
  const viewId = Behavon.useExport(presenterPort, "view");
  const [state, setState] = Behavon.useState(initial);
  const show = Behavon.useCallback((next: TodoState) => setState(next), [setState]);
  Behavon.useSlot(presenterPort, "show", show);

  const { items, filter, draft } = state;
  const list = Behavon.useMemo<ListView>(
    () => ({ items: items.filter((item) => visible(item, filter)) }),
    [items, filter],
  );
  const footer = Behavon.useMemo<FooterView>(() => {
    const completed = items.filter((item) => item.completed).length;
    return { remaining: items.length - completed, completed, filter };
  }, [items, filter]);
  const input = Behavon.useMemo<InputView>(() => ({ draft, canSubmit: draft.trim() !== "" }), [draft]);

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => publish(list), [list, publish]);
  Behavon.useEffect(() => publish(viewId.footer, footer), [footer, publish, viewId]);
  Behavon.useEffect(() => publish(viewId.input, input), [input, publish, viewId]);
  return undefined;
};
