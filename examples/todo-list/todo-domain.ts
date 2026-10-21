import Behavon, { type Model, type Signal, type Slot, type TypedModelRef } from "behavon";

export type Filter = "all" | "active" | "completed";

export interface TodoItem {
  readonly id: number;
  readonly text: string;
  readonly completed: boolean;
}

export interface TodoState {
  readonly items: readonly TodoItem[];
  readonly filter: Filter;
  readonly draft: string;
  readonly nextId: number;
}

type TodoAction =
  | { readonly type: "setDraft"; readonly draft: string }
  | { readonly type: "submit" }
  | { readonly type: "toggle"; readonly id: number }
  | { readonly type: "remove"; readonly id: number }
  | { readonly type: "setFilter"; readonly filter: Filter }
  | { readonly type: "clearCompleted" };

export function initialTodoState(texts: readonly string[]): TodoState {
  return {
    items: texts.map((text, index) => ({ id: index + 1, text, completed: false })),
    filter: "all",
    draft: "",
    nextId: texts.length + 1,
  };
}

export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case "setDraft":
      return { ...state, draft: action.draft };
    case "submit": {
      const text = state.draft.trim();
      if (text === "") return state;
      return {
        ...state,
        items: [...state.items, { id: state.nextId, text, completed: false }],
        draft: "",
        nextId: state.nextId + 1,
      };
    }
    case "toggle":
      return {
        ...state,
        items: state.items.map((item) => item.id === action.id ? { ...item, completed: !item.completed } : item),
      };
    case "remove":
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case "setFilter":
      return { ...state, filter: action.filter };
    case "clearCompleted":
      return { ...state, items: state.items.filter((item) => !item.completed) };
  }
}

/** The Presenter Slot that receives every new state. */
export interface TodoStateReceiver {
  show: Slot<[state: TodoState]>;
}

export interface TodoCommands {
  setDraft: Signal<[draft: string]>;
  submit: Signal;
  toggle: Signal<[id: number]>;
  remove: Signal<[id: number]>;
  setFilter: Signal<[filter: Filter]>;
  clearCompleted: Signal;
  /** Sent with every new state. */
  changed: Signal<[state: TodoState]>;
}

const domainPort = Behavon.createPort<TodoCommands>({
  setDraft: Behavon.SignalType(),
  submit: Behavon.SignalType(),
  toggle: Behavon.SignalType(),
  remove: Behavon.SignalType(),
  setFilter: Behavon.SignalType(),
  clearCompleted: Behavon.SignalType(),
  changed: Behavon.SignalType(),
});

export interface TodoDomainInput {
  readonly initial: TodoState;
  readonly presenter: TypedModelRef<TodoStateReceiver>;
}

/** Owns the todo state. Sends each new state to the Presenter through its `changed` Signal. */
export const TodoDomain: Model<TodoDomainInput, TodoState, TodoCommands> = (input) => {
  const [state, dispatch] = Behavon.useReducer(todoReducer, input.initial);

  const changedBody = Behavon.useCallback((_state: TodoState) => undefined, []);
  const changed = Behavon.useSignal(domainPort, "changed", changedBody);
  Behavon.useExport(domainPort, "changed");
  const presenter = Behavon.usePort(input.presenter);
  Behavon.useConnect(changed, presenter.show);
  Behavon.useEffect(() => {
    changed(state);
  }, [changed, state]);

  const setDraft = Behavon.useCallback((draft: string) => dispatch({ type: "setDraft", draft }), [dispatch]);
  Behavon.useSignal(domainPort, "setDraft", setDraft);
  Behavon.useExport(domainPort, "setDraft");

  const submit = Behavon.useCallback(() => dispatch({ type: "submit" }), [dispatch]);
  Behavon.useSignal(domainPort, "submit", submit);
  Behavon.useExport(domainPort, "submit");

  const toggle = Behavon.useCallback((id: number) => dispatch({ type: "toggle", id }), [dispatch]);
  Behavon.useSignal(domainPort, "toggle", toggle);
  Behavon.useExport(domainPort, "toggle");

  const remove = Behavon.useCallback((id: number) => dispatch({ type: "remove", id }), [dispatch]);
  Behavon.useSignal(domainPort, "remove", remove);
  Behavon.useExport(domainPort, "remove");

  const setFilter = Behavon.useCallback((filter: Filter) => dispatch({ type: "setFilter", filter }), [dispatch]);
  Behavon.useSignal(domainPort, "setFilter", setFilter);
  Behavon.useExport(domainPort, "setFilter");

  const clearCompleted = Behavon.useCallback(() => dispatch({ type: "clearCompleted" }), [dispatch]);
  Behavon.useSignal(domainPort, "clearCompleted", clearCompleted);
  Behavon.useExport(domainPort, "clearCompleted");

  return state;
};
