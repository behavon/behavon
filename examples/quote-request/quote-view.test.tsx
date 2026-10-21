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
      { name: "가나상사", priceOf: first.priceOf },
      { name: "다라유통", priceOf: second.priceOf },
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

    await run(() => type("품목", "볼트"));
    await run(() => type("수량", "20"));
    await run(() => (container.querySelector("button[type='submit']") as HTMLButtonElement).click());
    expect(text("[role='status']")).toBe("볼트 20개: 응답 0개");

    await run(() => second.latest().answer(9));
    await run(() => first.latest().answer(undefined));
    expect([...container.querySelectorAll("ol li")].map((item) => item.textContent)).toEqual([
      "다라유통: 개당 9원, 합계 180원",
      "가나상사: 공급 불가",
    ]);
    expect(text("[aria-label='최저가']")).toBe("최저가 다라유통 180원");

    await act(async () => root.unmount());
    container.remove();
    dispose();
  });
});
