// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createFakePriceSource } from "./fake-price-source";
import { createQuoteRequest } from "./quote-board";
import { QuoteView } from "./quote-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("QuoteView", () => {
  it("requests quotes and shows the answers and the lowest price", async () => {
    const first = createFakePriceSource();
    const second = createFakePriceSource();
    const { board, dispose } = createQuoteRequest([
      { name: "Ganada", priceOf: first.priceOf },
      { name: "Dara", priceOf: second.priceOf },
    ]);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<QuoteView board={board} />));

    const run = async (action: () => void) => {
      await act(async () => {
        action();
        await settle();
      });
    };
    const type = (label: string, value: string) => {
      const field = container.querySelector(`input[aria-label='${label}']`) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const text = (selector: string) => container.querySelector(selector)?.textContent;

    await run(() => type("Item", "bolt"));
    await run(() => type("Quantity", "20"));
    await run(() => (container.querySelector("button[type='submit']") as HTMLButtonElement).click());
    expect(text("[role='status']")).toBe("bolt × 20: 0 answers");

    await run(() => second.latest().answer(9));
    await run(() => first.latest().answer(undefined));
    expect([...container.querySelectorAll("ol li")].map((item) => item.textContent)).toEqual([
      "Dara: 9 each, 180 in total",
      "Ganada: Not available",
    ]);
    expect(text("[aria-label='Lowest price']")).toBe("Lowest: Dara 180");

    await act(async () => root.unmount());
    container.remove();
    dispose();
  });
});
