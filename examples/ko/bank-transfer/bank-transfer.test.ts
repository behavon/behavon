import { describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import { Account } from "./account";
import { createBank } from "./bank";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function openBank() {
  const created = createBank({
    accounts: {
      kim: { name: "김", balance: 10_000 },
      lee: { name: "이", balance: 0 },
      bank: { name: "수수료", balance: 0 },
    },
    feeAccount: "bank",
    fee: 500,
  });
  const balances = () => Object.fromEntries(
    created.accounts.map(({ id, account }) => [id, Behavon.getSnapshot(account.view)()?.balance]),
  );
  return { ...created, balances, view: Behavon.getSnapshot(created.bank.view) };
}

describe("bank-transfer", () => {
  it("moves the amount and the fee and records the transfer", async () => {
    const { bank, balances, view, dispose } = openBank();
    bank.transfer("kim", "lee", 3_000);
    await settle();
    expect(balances()).toEqual({ kim: 6_500, lee: 3_000, bank: 500 });
    expect(view()).toEqual({
      transfers: [{ id: 1, from: "kim", to: "lee", amount: 3_000, fee: 500 }],
      failures: [],
    });
    dispose();
  });

  it("undoes the deposits and the record when the withdrawal is refused", async () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { bank, balances, view, dispose } = openBank();
    bank.transfer("kim", "lee", 9_800);
    await settle();
    expect(balances()).toEqual({ kim: 10_000, lee: 0, bank: 0 });
    expect(view()).toEqual({
      transfers: [],
      failures: [{ id: 1, message: "김 잔액 부족: 잔액 10000원, 출금 10300원" }],
    });
    expect(warnings).not.toHaveBeenCalled();
    dispose();
  });

  it("checks the second of two transfers in the same tick against the balance after the first", async () => {
    const { bank, balances, view, dispose } = openBank();
    bank.transfer("kim", "lee", 6_000);
    bank.transfer("kim", "lee", 6_000);
    await settle();
    expect(balances()).toEqual({ kim: 3_500, lee: 6_000, bank: 500 });
    expect(view()?.transfers.map((item) => item.id)).toEqual([1]);
    expect(view()?.failures).toEqual([{ id: 2, message: "김 잔액 부족: 잔액 3500원, 출금 6500원" }]);
    dispose();
  });

  it("refuses unknown accounts, the same account, and amounts that are not positive whole numbers", async () => {
    const { bank, balances, view, dispose } = openBank();
    bank.transfer("kim", "park", 1_000);
    bank.transfer("kim", "kim", 1_000);
    bank.transfer("kim", "bank", 1_000);
    bank.transfer("kim", "lee", 0);
    bank.transfer("kim", "lee", 1.5);
    await settle();
    expect(balances()).toEqual({ kim: 10_000, lee: 0, bank: 0 });
    expect(view()?.failures.map((item) => item.message)).toEqual([
      "없는 계좌",
      "같은 계좌 사이에는 이체할 수 없음",
      "같은 계좌 사이에는 이체할 수 없음",
      "금액은 1원 이상의 정수",
      "금액은 1원 이상의 정수",
    ]);
    dispose();
  });

  it("lets an account deposit and withdraw on its own", async () => {
    const account = Behavon.createModel(Account, { name: "김", balance: 1_000 });
    account.deposit(500);
    await settle();
    account.withdraw(300);
    await settle();
    expect(Behavon.getSnapshot(account.view)()).toEqual({ name: "김", balance: 1_200 });
    expect(() => account.withdraw(5_000)).toThrow("김 잔액 부족");
    account.dispose();
  });
});
