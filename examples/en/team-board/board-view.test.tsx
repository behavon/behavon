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
      members: [{ id: "kim", name: "Kim" }, { id: "lee", name: "Lee" }],
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
      const field = container.querySelector("input[aria-label='New task']") as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };

    await run(() => button("Lee").click());
    expect(button("Lee").getAttribute("aria-pressed")).toBe("true");
    await run(() => type("Prepare the talk"));
    await run(() => button("Add for Lee").click());
    expect(container.querySelector("li span")?.textContent).toBe("Lee");

    await run(() => (container.querySelector("li input[type='checkbox']") as HTMLInputElement).click());
    expect(container.querySelector("[aria-label='Progress']")?.textContent).toBe("1/1 done (100%)");

    await act(async () => root.unmount());
    container.remove();
    dispose();
  });
});
