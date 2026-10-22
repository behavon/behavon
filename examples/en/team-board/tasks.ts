import Behavon, { type Model, type Signal, type Slot, type SnapshotRootId } from "behavon";
import type { Member } from "./members";

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly assignee: Member | undefined;
}

/** The server the tasks are stored on. */
export interface TaskTransport {
  load(): Promise<readonly Task[]>;
  create(title: string, assignee: Member | undefined): Promise<Task>;
}

export interface TasksView {
  readonly tasks: readonly Task[];
  readonly assignee: Member | undefined;
  readonly remaining: number;
  readonly loading: boolean;
  readonly error: string | undefined;
}

export interface TasksPort {
  view: SnapshotRootId<TasksView>;
  memberSelected: Slot<[member: Member]>;
  add: Signal<[title: string]>;
  toggle: Signal<[taskId: string]>;
  load: Signal;
}

const tasksPort = Behavon.createPort<TasksPort>({
  view: Behavon.SnapshotType(),
  memberSelected: Behavon.SlotType(),
  add: Behavon.SignalType(),
  toggle: Behavon.SignalType(),
  load: Behavon.SignalType(),
});

export interface TasksInput {
  readonly transport: TaskTransport;
  /** Receives a short report whenever it changes. A returned function runs before the next report. */
  readonly reportTo?: (report: string) => void | (() => void);
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Holds the tasks. Adding and loading go through the server. */
export const Tasks: Model<TasksInput, readonly Task[], TasksPort> = (input) => {
  const { transport, reportTo } = input;
  const viewId = Behavon.useExport(tasksPort, "view");
  const [tasks, setTasks] = Behavon.useState<readonly Task[]>([]);
  const [assignee, setAssignee] = Behavon.useState<Member>();
  const [pending, setPending] = Behavon.useState(0);
  const [error, setError] = Behavon.useState<string>();

  const remaining = Behavon.useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);
  const report = `${remaining} left`;
  Behavon.useEffect(() => reportTo?.(report), [report, reportTo]);

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ tasks, assignee, remaining, loading: pending > 0, error });
  }, [assignee, error, pending, publish, remaining, tasks]);

  const memberSelected = Behavon.useCallback((member: Member) => setAssignee(member), [setAssignee]);
  Behavon.useSlot(tasksPort, "memberSelected", memberSelected);

  const add = Behavon.useCallback(async (title: string) => {
    setPending((n) => n + 1);
    setError(undefined);
    try {
      const task = await transport.create(title, assignee);
      setTasks((current) => [...current, task]);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setPending((n) => n - 1);
    }
  }, [assignee, setError, setPending, setTasks, transport]);
  Behavon.useSignal(tasksPort, "add", add);
  Behavon.useExport(tasksPort, "add");

  const toggle = Behavon.useCallback((taskId: string) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task));
  }, [setTasks]);
  Behavon.useSignal(tasksPort, "toggle", toggle);
  Behavon.useExport(tasksPort, "toggle");

  const load = Behavon.useCallback(async () => {
    setPending((n) => n + 1);
    setError(undefined);
    try {
      setTasks(await transport.load());
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setPending((n) => n - 1);
    }
  }, [setError, setPending, setTasks, transport]);
  Behavon.useSignal(tasksPort, "load", load);
  Behavon.useExport(tasksPort, "load");

  return tasks;
};
