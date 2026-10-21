import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createTodoList } from "./todo-app";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("todo-list", () => {
  it("publishes the starting list, footer, and input", () => {
    const { app, dispose } = createTodoList(["우유 사기", "편지 쓰기"]);
    expect(Behavon.getSnapshot(app.view)()?.items.map((item) => item.text)).toEqual(["우유 사기", "편지 쓰기"]);
    expect(Behavon.getSnapshot(app.view.footer)()).toEqual({ remaining: 2, completed: 0, filter: "all" });
    expect(Behavon.getSnapshot(app.view.input)()).toEqual({ draft: "", canSubmit: false });
    dispose();
  });

  it("adds, toggles, filters, removes, and clears", async () => {
    const { app, dispose } = createTodoList(["우유 사기"]);
    const list = Behavon.getSnapshot(app.view);
    const footer = Behavon.getSnapshot(app.view.footer);

    app.setDraft("  빨래하기  ");
    await settle();
    expect(Behavon.getSnapshot(app.view.input)()).toEqual({ draft: "  빨래하기  ", canSubmit: true });
    app.submit();
    await settle();
    expect(list()?.items.map((item) => item.text)).toEqual(["우유 사기", "빨래하기"]);
    expect(Behavon.getSnapshot(app.view.input)()).toEqual({ draft: "", canSubmit: false });

    const [milk] = list()?.items ?? [];
    app.toggle(milk.id);
    await settle();
    expect(footer()).toEqual({ remaining: 1, completed: 1, filter: "all" });

    app.setFilter("active");
    await settle();
    expect(list()?.items.map((item) => item.text)).toEqual(["빨래하기"]);
    app.setFilter("completed");
    await settle();
    expect(list()?.items.map((item) => item.text)).toEqual(["우유 사기"]);

    app.clearCompleted();
    await settle();
    expect(list()?.items).toEqual([]);
    app.setFilter("all");
    await settle();
    expect(list()?.items.map((item) => item.text)).toEqual(["빨래하기"]);

    const [laundry] = list()?.items ?? [];
    app.remove(laundry.id);
    await settle();
    expect(footer()).toEqual({ remaining: 0, completed: 0, filter: "all" });
    dispose();
  });

  it("does not add an empty draft", async () => {
    const { app, dispose } = createTodoList();
    app.setDraft("   ");
    app.submit();
    await settle();
    expect(Behavon.getSnapshot(app.view)()?.items).toEqual([]);
    dispose();
  });

  it("notifies only the input part while typing", async () => {
    const { app, dispose } = createTodoList(["우유 사기"]);
    const calls = { list: 0, footer: 0, input: 0 };
    const off = [
      Behavon.subscribe(app.view)(() => { calls.list += 1; }),
      Behavon.subscribe(app.view.footer)(() => { calls.footer += 1; }),
      Behavon.subscribe(app.view.input)(() => { calls.input += 1; }),
    ];
    app.setDraft("a");
    await settle();
    app.setDraft("ab");
    await settle();
    expect(calls).toEqual({ list: 0, footer: 0, input: 2 });
    for (const unsubscribe of off) unsubscribe();
    dispose();
  });

  it("keeps the Domain and its changed event out of the screen's reach", () => {
    const { app, dispose } = createTodoList();
    const screen = app as unknown as Record<string, unknown>;
    expect(() => screen.changed).toThrow(/has no endpoint 'changed'/);
    expect(() => screen.show).toThrow(/has no endpoint 'show'/);
    dispose();
  });

  it("releases the snapshots on dispose", () => {
    const { app, dispose } = createTodoList();
    const view = app.view;
    dispose();
    expect(() => Behavon.getSnapshot(view)).toThrow(/no live owner/);
  });
});
