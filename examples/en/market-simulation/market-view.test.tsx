// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketView } from "./market-view";
import { defaultScenario } from "./scenario";
import { createSimulation } from "./simulation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("MarketView", () => {
  it("advances a step and shows the prices, the traders, and the orders of that step", async () => {
    const simulation = createSimulation(defaultScenario);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<MarketView clock={simulation.clock} views={simulation.views} />));
    expect(container.querySelector("[role='status']")?.textContent).toBe("Step 0");

    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
      await settle();
    });
    const { exchange } = simulation.summary();
    expect(container.querySelector("[role='status']")?.textContent).toBe("Step 1");
    expect([...container.querySelectorAll("ul[aria-label='Prices'] li")].map((item) => item.textContent)).toEqual(
      Object.entries(exchange?.prices ?? {}).map(([stockId, price]) => `${stockId} ${price}`),
    );
    expect(container.querySelectorAll("tbody tr")).toHaveLength(defaultScenario.traders.length);
    expect(container.querySelectorAll("ol[aria-label='Refusals this step'] li")).toHaveLength(2);

    await act(async () => root.unmount());
    container.remove();
    simulation.dispose();
  });
});
