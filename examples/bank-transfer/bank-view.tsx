import { useState, useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { AccountScreenPort } from "./account";
import type { BankPort } from "./bank";

interface AccountEntry {
  readonly id: string;
  readonly account: TypedModelRef<AccountScreenPort>;
}

function AccountRow({ entry }: { readonly entry: AccountEntry }) {
  const view = useSyncExternalStore(Behavon.subscribe(entry.account.view), Behavon.getSnapshot(entry.account.view));
  if (view === undefined) return null;
  return <li data-account={entry.id}>{view.name}: {view.balance}원</li>;
}

export function BankView({ bank, accounts }: { readonly bank: TypedModelRef<BankPort>; readonly accounts: readonly AccountEntry[] }) {
  const view = useSyncExternalStore(Behavon.subscribe(bank.view), Behavon.getSnapshot(bank.view));
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState(0);
  if (view === undefined) return null;
  const lastFailure = view.failures.at(-1);
  return (
    <main>
      <ul aria-label="계좌">
        {accounts.map((entry) => <AccountRow key={entry.id} entry={entry} />)}
      </ul>
      <form onSubmit={(event) => { event.preventDefault(); bank.transfer(from, to, amount); }}>
        <select aria-label="보내는 계좌" value={from} onChange={(event) => setFrom(event.target.value)}>
          {accounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.id}</option>)}
        </select>
        <select aria-label="받는 계좌" value={to} onChange={(event) => setTo(event.target.value)}>
          {accounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.id}</option>)}
        </select>
        <input aria-label="금액" type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
        <button type="submit">이체</button>
      </form>
      {lastFailure !== undefined && <p role="alert">이체 {lastFailure.id} 실패: {lastFailure.message}</p>}
      <ol aria-label="이체 기록">
        {view.transfers.map((item) => (
          <li key={item.id}>{item.from} → {item.to} {item.amount}원 (수수료 {item.fee}원)</li>
        ))}
      </ol>
    </main>
  );
}
