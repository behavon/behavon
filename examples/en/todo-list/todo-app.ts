import Behavon, { type Model, type Signal, type TypedModelRef } from "behavon";
import { initialTodoState, TodoDomain, type Filter, type TodoCommands } from "./todo-domain";
import { TodoPresenter, type TodoViewId } from "./todo-presenter";

/** The only object the screen receives: the commands and the view snapshot ids. */
export interface TodoAppPort {
  view: TodoViewId;
  setDraft: Signal<[draft: string]>;
  submit: Signal;
  toggle: Signal<[id: number]>;
  remove: Signal<[id: number]>;
  setFilter: Signal<[filter: Filter]>;
  clearCompleted: Signal;
}

const appPort = Behavon.createPort<TodoAppPort>({
  view: {
    $: Behavon.SnapshotType(),
    footer: Behavon.SnapshotType(),
    input: Behavon.SnapshotType(),
  },
  setDraft: Behavon.SignalType(),
  submit: Behavon.SignalType(),
  toggle: Behavon.SignalType(),
  remove: Behavon.SignalType(),
  setFilter: Behavon.SignalType(),
  clearCompleted: Behavon.SignalType(),
});

export interface TodoAppInput {
  readonly domain: TypedModelRef<TodoCommands>;
  readonly presenter: TypedModelRef<{ view: TodoViewId }>;
}

/** Forwards the commands to the Domain and re-exports the Presenter's view, hiding both. */
export const TodoApp: Model<TodoAppInput, undefined, TodoAppPort> = (input) => {
  const domain = Behavon.usePort(input.domain);
  const presenter = Behavon.usePort(input.presenter);
  Behavon.useExport(appPort, "view", presenter.view);

  const setDraft = Behavon.useCallback((draft: string) => domain.setDraft(draft), [domain]);
  Behavon.useSignal(appPort, "setDraft", setDraft);
  Behavon.useExport(appPort, "setDraft");

  const submit = Behavon.useCallback(() => domain.submit(), [domain]);
  Behavon.useSignal(appPort, "submit", submit);
  Behavon.useExport(appPort, "submit");

  const toggle = Behavon.useCallback((id: number) => domain.toggle(id), [domain]);
  Behavon.useSignal(appPort, "toggle", toggle);
  Behavon.useExport(appPort, "toggle");

  const remove = Behavon.useCallback((id: number) => domain.remove(id), [domain]);
  Behavon.useSignal(appPort, "remove", remove);
  Behavon.useExport(appPort, "remove");

  const setFilter = Behavon.useCallback((filter: Filter) => domain.setFilter(filter), [domain]);
  Behavon.useSignal(appPort, "setFilter", setFilter);
  Behavon.useExport(appPort, "setFilter");

  const clearCompleted = Behavon.useCallback(() => domain.clearCompleted(), [domain]);
  Behavon.useSignal(appPort, "clearCompleted", clearCompleted);
  Behavon.useExport(appPort, "clearCompleted");

  return undefined;
};

/** Creates the Presenter, the Domain, and the App. `dispose` releases them in reverse order. */
export function createTodoList(texts: readonly string[] = []) {
  const initial = initialTodoState(texts);
  const presenter = Behavon.createModel(TodoPresenter, initial);
  const domain = Behavon.createModel(TodoDomain, { initial, presenter });
  const app = Behavon.createModel(TodoApp, { domain, presenter });
  return {
    app,
    dispose() {
      app.dispose();
      domain.dispose();
      presenter.dispose();
    },
  };
}
