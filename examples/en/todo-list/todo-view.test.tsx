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
    const { app, dispose } = createTodoList(["Buy milk"]);
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
    const field = container.querySelector("input[aria-label='Task']") as HTMLInputElement;

    expect(texts()).toEqual(["Buy milk"]);
    expect(button("Add").disabled).toBe(true);

    await run(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(field, "Do the laundry");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(field.value).toBe("Do the laundry");
    await run(() => button("Add").click());
    expect(texts()).toEqual(["Buy milk", "Do the laundry"]);
    expect(field.value).toBe("");

    await run(() => (container.querySelector("li input[type='checkbox']") as HTMLInputElement).click());
    expect(container.querySelector("footer span")?.textContent).toBe("1 left");

    await run(() => button("Active").click());
    expect(texts()).toEqual(["Do the laundry"]);
    await run(() => button("All").click());
    await run(() => button("Clear completed").click());
    expect(texts()).toEqual(["Do the laundry"]);

    await act(async () => root.unmount());
    container.remove();
    dispose();
  });
});
