// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createBank } from "./bank";
import { BankView } from "./bank-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("BankView", () => {
  it("transfers, shows the balances and the record, and shows a refused transfer", async () => {
    const { bank, accounts, dispose } = createBank({
      accounts: { kim: { name: "김", balance: 5_000 }, lee: { name: "이", balance: 0 }, bank: { name: "수수료", balance: 0 } },
      feeAccount: "bank",
      fee: 100,
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<BankView bank={bank} accounts={accounts} />));

    const run = async (action: () => void) => {
      await act(async () => {
        action();
        await settle();
      });
    };
    const setAmount = (value: string) => {
      const field = container.querySelector("input[aria-label='금액']") as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const submit = () => (container.querySelector("button[type='submit']") as HTMLButtonElement).click();
    const balances = () => [...container.querySelectorAll("ul[aria-label='계좌'] li")].map((item) => item.textContent);

    await run(() => setAmount("2000"));
    await run(submit);
    expect(balances()).toEqual(["김: 2900원", "이: 2000원", "수수료: 100원"]);
    expect(container.querySelector("ol li")?.textContent).toBe("kim → lee 2000원 (수수료 100원)");

    await run(() => setAmount("3000"));
    await run(submit);
    expect(balances()).toEqual(["김: 2900원", "이: 2000원", "수수료: 100원"]);
    expect(container.querySelector("[role='alert']")?.textContent).toBe("이체 2 실패: 김 잔액 부족: 잔액 2900원, 출금 3100원");

    await act(async () => root.unmount());
    container.remove();
    dispose();
  });
});
