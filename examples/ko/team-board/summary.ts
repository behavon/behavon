import Behavon, { type Model, type ModelInstance, type SnapshotRootId } from "behavon";
import type { Task, TasksInput, TasksPort } from "./tasks";

export interface SummaryView {
  readonly total: number;
  readonly completed: number;
  /** 0 to 100. */
  readonly progress: number;
}

export interface SummaryPort {
  view: SnapshotRootId<SummaryView>;
}

const summaryPort = Behavon.createPort<SummaryPort>({ view: Behavon.SnapshotType() });

/** Derived from the Tasks result: it re-evaluates whenever the tasks change. */
export const Summary: Model<ModelInstance<TasksInput, readonly Task[], TasksPort>, undefined, SummaryPort> = (tasks) => {
  const viewId = Behavon.useExport(summaryPort, "view");
  const [list] = Behavon.useModel(tasks);
  const view = Behavon.useMemo<SummaryView>(() => {
    const completed = list.filter((task) => task.completed).length;
    const progress = list.length === 0 ? 0 : Math.round((completed / list.length) * 100);
    return { total: list.length, completed, progress };
  }, [list]);
  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => publish(view), [publish, view]);
  return undefined;
};
