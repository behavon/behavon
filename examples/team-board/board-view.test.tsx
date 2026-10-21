// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createTeamBoard } from "./board";
import { BoardView } from "./board-view";
import { createFakeTransport } from "./fake-transport";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("BoardView", () => {
  it("selects a member, adds a task for them, and shows the progress", async () => {
    const server = createFakeTransport();
    const { board, dispose } = createTeamBoard({
      members: [{ id: "kim", name: "김" }, { id: "lee", name: "이" }],
      transport: server.transport,
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<BoardView board={board} />));

    const run = async (action: () => void) => {
      await act(async () => {
        action();
        await settle();
      });
    };
    const button = (label: string) =>
      [...container.querySelectorAll("button")].find((item) => item.textContent === label) as HTMLButtonElement;
    const type = (value: string) => {
      const field = container.querySelector("input[aria-label='새 할 일']") as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };

    await run(() => button("이").click());
    expect(button("이").getAttribute("aria-pressed")).toBe("true");
    await run(() => type("발표 준비"));
    await run(() => button("이에게 추가").click());
    expect(container.querySelector("li span")?.textContent).toBe("이");

    await run(() => (container.querySelector("li input[type='checkbox']") as HTMLInputElement).click());
    expect(container.querySelector("[aria-label='진행률']")?.textContent).toBe("1/1 완료 (100%)");

    await act(async () => root.unmount());
    container.remove();
    dispose();
  });
});
