import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createTeamBoard } from "./board";
import { createFakeTransport } from "./fake-transport";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const members = [
  { id: "kim", name: "김" },
  { id: "lee", name: "이" },
];

describe("team-board", () => {
  it("assigns new tasks to the selected member", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    const tasks = Behavon.getSnapshot(board.tasks);

    board.add("회의록 정리");
    await settle();
    expect(tasks()?.tasks.map((task) => task.assignee)).toEqual([undefined]);

    board.select("lee");
    await settle();
    expect(Behavon.getSnapshot(board.members)()?.selectedId).toBe("lee");
    expect(tasks()?.assignee).toEqual({ id: "lee", name: "이" });

    board.add("발표 준비");
    await settle();
    expect(tasks()?.tasks.map((task) => [task.title, task.assignee?.name])).toEqual([
      ["회의록 정리", undefined],
      ["발표 준비", "이"],
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
    board.add("바로 추가");
    await settle();
    expect(Behavon.getSnapshot(board.tasks)()?.tasks[0].assignee).toBeUndefined();
    dispose();
  });

  it("shows loading while the server works and the error when it fails", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    const tasks = Behavon.getSnapshot(board.tasks);

    server.hold();
    board.add("보고서");
    await settle();
    expect(tasks()?.loading).toBe(true);
    server.release();
    await settle();
    expect(tasks()?.loading).toBe(false);
    expect(tasks()?.tasks).toHaveLength(1);

    server.failNext("서버 오류");
    board.add("실패할 일");
    await settle();
    expect(tasks()).toMatchObject({ loading: false, error: "서버 오류" });
    expect(tasks()?.tasks).toHaveLength(1);

    board.add("다시 시도");
    await settle();
    expect(tasks()?.error).toBeUndefined();
    dispose();
  });

  it("loads the stored tasks", async () => {
    const server = createFakeTransport([{ id: "t1", title: "저장된 일", completed: true, assignee: undefined }]);
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    board.load();
    await settle();
    expect(Behavon.getSnapshot(board.tasks)()?.tasks.map((task) => task.title)).toEqual(["저장된 일"]);
    dispose();
  });

  it("derives the progress from the tasks", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    const summary = Behavon.getSnapshot(board.summary);
    expect(summary()).toEqual({ total: 0, completed: 0, progress: 0 });

    board.add("하나");
    board.add("둘");
    board.add("셋");
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
    board.add("하나");
    await settle();
    dispose();
    expect(log).toEqual(["show 남은 일 0개", "hide 남은 일 0개", "show 남은 일 1개", "hide 남은 일 1개"]);
  });

  it("releases every view on dispose", () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({ members, transport: server.transport });
    const ids = [board.members, board.tasks, board.summary];
    dispose();
    for (const id of ids) expect(() => Behavon.getSnapshot(id)).toThrow(/no live owner/);
  });
});
