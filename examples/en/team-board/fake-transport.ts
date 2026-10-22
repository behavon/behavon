import type { Member } from "./members";
import type { Task, TaskTransport } from "./tasks";

/** An in-memory server for the tests and the demo. Each call can be held open until `release`. */
export function createFakeTransport(initial: readonly Task[] = []) {
  let stored = [...initial];
  let nextId = initial.length + 1;
  let held: Array<() => void> = [];
  let holding = false;
  let failNext: string | undefined;

  function settle<Value>(produce: () => Value): Promise<Value> {
    return new Promise<Value>((resolve, reject) => {
      const finish = () => {
        if (failNext !== undefined) {
          const message = failNext;
          failNext = undefined;
          reject(new Error(message));
          return;
        }
        resolve(produce());
      };
      if (holding) held.push(finish);
      else queueMicrotask(finish);
    });
  }

  const transport: TaskTransport = {
    load: () => settle(() => [...stored]),
    create: (title: string, assignee: Member | undefined) =>
      settle(() => {
        const task: Task = { id: `t${nextId++}`, title, completed: false, assignee };
        stored = [...stored, task];
        return task;
      }),
  };

  return {
    transport,
    /** Keeps the next calls pending until `release`. */
    hold() {
      holding = true;
    },
    release() {
      holding = false;
      const waiting = held;
      held = [];
      for (const finish of waiting) finish();
    },
    failNext(message: string) {
      failNext = message;
    },
  };
}
