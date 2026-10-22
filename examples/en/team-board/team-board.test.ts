import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createTeamBoard } from "./board";
import { createFakeTransport } from "./fake-transport";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const members = [
  { id: "kim", name: "Kim" },
  { id: "lee", name: "Lee" },
];

describe("team-board", () => {
  it("assigns new tasks to the selected member", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    const tasks = Behavon.getSnapshot(board.tasks);

    board.add("Write up the minutes");
    await settle();
    expect(tasks()?.tasks.map((task) => task.assignee)).toEqual([undefined]);

    board.select("lee");
    await settle();
    expect(Behavon.getSnapshot(board.members)()?.selectedId).toBe("lee");
    expect(tasks()?.assignee).toEqual({ id: "lee", name: "Lee" });

    board.add("Prepare the talk");
    await settle();
    expect(tasks()?.tasks.map((task) => [task.title, task.assignee?.name])).toEqual([
      ["Write up the minutes", undefined],
      ["Prepare the talk", "Lee"],
    ]);
    dispose();
  });

  it("ignores an unknown member", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    board.select("nobody");
    await settle();
    expect(Behavon.getSnapshot(board.members)()?.selectedId).toBeUndefined();
    dispose();
  });

  it("uses the assignee committed when add was registered", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    board.select("kim");
    board.add("Add right away");
    await settle();
    expect(Behavon.getSnapshot(board.tasks)()?.tasks[0].assignee).toBeUndefined();
    dispose();
  });

  it("shows loading while the server works and the error when it fails", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    const tasks = Behavon.getSnapshot(board.tasks);

    server.hold();
    board.add("Report");
    await settle();
    expect(tasks()?.loading).toBe(true);
    server.release();
    await settle();
    expect(tasks()?.loading).toBe(false);
    expect(tasks()?.tasks).toHaveLength(1);

    server.failNext("Server error");
    board.add("Task that fails");
    await settle();
    expect(tasks()).toMatchObject({ loading: false, error: "Server error" });
    expect(tasks()?.tasks).toHaveLength(1);

    board.add("Try again");
    await settle();
    expect(tasks()?.error).toBeUndefined();
    dispose();
  });

  it("loads the stored tasks", async () => {
    const server = createFakeTransport([{ id: "t1", title: "Saved task", completed: true, assignee: undefined }]);
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    board.load();
    await settle();
    expect(Behavon.getSnapshot(board.tasks)()?.tasks.map((task) => task.title)).toEqual(["Saved task"]);
    dispose();
  });

  it("derives the progress from the tasks", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    const summary = Behavon.getSnapshot(board.summary);
    expect(summary()).toEqual({ total: 0, completed: 0, progress: 0 });

    board.add("One");
    board.add("Two");
    board.add("Three");
    await settle();
    const [first] = Behavon.getSnapshot(board.tasks)()?.tasks ?? [];
    board.toggle(first.id);
    await settle();
    expect(summary()).toEqual({ total: 3, completed: 1, progress: 33 });
    dispose();
  });

  it("cleans up the previous report before the next one and on dispose", async () => {
    const log: string[] = [];
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({
      members,
      transport: server.transport,
      reportTo: (report) => {
        log.push(`show ${report}`);
        return () => log.push(`hide ${report}`);
      },
    });
    board.add("One");
    await settle();
    dispose();
    expect(log).toEqual(["show 0 left", "hide 0 left", "show 1 left", "hide 1 left"]);
  });

  it("releases every view on dispose", () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    const ids = [board.members, board.tasks, board.summary];
    dispose();
    for (const id of ids) expect(() => Behavon.getSnapshot(id)).toThrow(/no live owner/);
  });
});
