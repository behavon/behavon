// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { Counter } from "./counter";
import { CounterView } from "./counter-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("CounterView", () => {
  it("shows the count and sends commands from the buttons", async () => {
    const counter = Behavon.createModel(Counter, 0);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<CounterView counter={counter} />));

    const output = () => container.querySelector("output")?.textContent;
    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label);
      await act(async () => {
        button?.click();
        await settle();
      });
    };

    expect(output()).toBe("0");
    expect(container.querySelector("p")?.textContent).toBe("0입니다");
    await click("+1");
    expect(output()).toBe("1");
    await click("+5");
    expect(output()).toBe("6");
    await click("-1");
    expect(output()).toBe("5");
    await click("초기화");
    expect(output()).toBe("0");

    await act(async () => root.unmount());
    counter.dispose();
  });
});
