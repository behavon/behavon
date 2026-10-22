// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createTodoList } from "./todo-app";
import { TodoView } from "./todo-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("TodoView", () => {
  it("adds, completes, filters, and clears items from the screen", async () => {
    const { app, dispose } = createTodoList(["우유 사기"]);
    const container = document.createElement("div");
    // A form submits only while it is connected to the document.
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<TodoView app={app} />));

    const run = async (action: () => void) => {
      await act(async () => {
        action();
        await settle();
      });
    };
    const texts = () => [...container.querySelectorAll("li label")].map((label) => label.textContent);
    const button = (label: string) =>
      [...container.querySelectorAll("button")].find((item) => item.textContent === label) as HTMLButtonElement;
    const field = container.querySelector("input[aria-label='할 일']") as HTMLInputElement;

    expect(texts()).toEqual(["우유 사기"]);
    expect(button("추가").disabled).toBe(true);

    await run(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(field, "빨래하기");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(field.value).toBe("빨래하기");
    await run(() => button("추가").click());
    expect(texts()).toEqual(["우유 사기", "빨래하기"]);
    expect(field.value).toBe("");

    await run(() => (container.querySelector("li input[type='checkbox']") as HTMLInputElement).click());
    expect(container.querySelector("footer span")?.textContent).toBe("1개 남음");

    await run(() => button("남은 일").click());
    expect(texts()).toEqual(["빨래하기"]);
    await run(() => button("전체").click());
    await run(() => button("완료 항목 정리").click());
    expect(texts()).toEqual(["빨래하기"]);

    await act(async () => root.unmount());
    container.remove();
    dispose();
  });
});
