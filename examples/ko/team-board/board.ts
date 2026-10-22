import Behavon, { type Model, type Signal, type SnapshotRootId, type TypedModelRef } from "behavon";
import { Members, type Member, type MembersView } from "./members";
import { Summary, type SummaryView } from "./summary";
import { Tasks, type TaskTransport, type TasksView } from "./tasks";

/** The only object the screen receives. */
export interface BoardPort {
  members: SnapshotRootId<MembersView>;
  tasks: SnapshotRootId<TasksView>;
  summary: SnapshotRootId<SummaryView>;
  select: Signal<[memberId: string]>;
  add: Signal<[title: string]>;
  toggle: Signal<[taskId: string]>;
  load: Signal;
}

const boardPort = Behavon.createPort<BoardPort>({
  members: Behavon.SnapshotType(),
  tasks: Behavon.SnapshotType(),
  summary: Behavon.SnapshotType(),
  select: Behavon.SignalType(),
  add: Behavon.SignalType(),
  toggle: Behavon.SignalType(),
  load: Behavon.SignalType(),
});

export interface BoardInput {
  readonly members: TypedModelRef<{ view: SnapshotRootId<MembersView>; select: Signal<[memberId: string]> }>;
  readonly tasks: TypedModelRef<{
    view: SnapshotRootId<TasksView>;
    add: Signal<[title: string]>;
    toggle: Signal<[taskId: string]>;
    load: Signal;
  }>;
  readonly summary: TypedModelRef<{ view: SnapshotRootId<SummaryView> }>;
}

/** Forwards the commands and re-exports the three views. */
export const Board: Model<BoardInput, undefined, BoardPort> = (input) => {
  const members = Behavon.usePort(input.members);
  const tasks = Behavon.usePort(input.tasks);
  const summary = Behavon.usePort(input.summary);
  Behavon.useExport(boardPort, "members", members.view);
  Behavon.useExport(boardPort, "tasks", tasks.view);
  Behavon.useExport(boardPort, "summary", summary.view);

  const select = Behavon.useCallback((memberId: string) => members.select(memberId), [members]);
  Behavon.useSignal(boardPort, "select", select);
  Behavon.useExport(boardPort, "select");

  const add = Behavon.useCallback((title: string) => tasks.add(title), [tasks]);
  Behavon.useSignal(boardPort, "add", add);
  Behavon.useExport(boardPort, "add");

  const toggle = Behavon.useCallback((taskId: string) => tasks.toggle(taskId), [tasks]);
  Behavon.useSignal(boardPort, "toggle", toggle);
  Behavon.useExport(boardPort, "toggle");

  const load = Behavon.useCallback(() => tasks.load(), [tasks]);
  Behavon.useSignal(boardPort, "load", load);
  Behavon.useExport(boardPort, "load");

  return undefined;
};

export interface TeamBoardOptions {
  readonly members: readonly Member[];
  readonly transport: TaskTransport;
  readonly reportTo?: (report: string) => void | (() => void);
}

/** Creates Tasks, Members, Summary, and Board. `dispose` releases them in reverse order. */
export function createTeamBoard(options: TeamBoardOptions) {
  const tasks = Behavon.createModel(Tasks, { transport: options.transport, reportTo: options.reportTo });
  const members = Behavon.createModel(Members, { members: options.members, listener: tasks });
  const summary = Behavon.createModel(Summary, tasks);
  const board = Behavon.createModel(Board, { members, tasks, summary });
  return {
    board,
    dispose() {
      board.dispose();
      summary.dispose();
      members.dispose();
      tasks.dispose();
    },
  };
}
