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
  return <li data-account={entry.id}>{view.name}: {view.balance}</li>;
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
      <ul aria-label="Accounts">
        {accounts.map((entry) => <AccountRow key={entry.id} entry={entry} />)}
      </ul>
      <form onSubmit={(event) => { event.preventDefault(); bank.transfer(from, to, amount); }}>
        <select aria-label="From account" value={from} onChange={(event) => setFrom(event.target.value)}>
          {accounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.id}</option>)}
        </select>
        <select aria-label="To account" value={to} onChange={(event) => setTo(event.target.value)}>
          {accounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.id}</option>)}
        </select>
        <input aria-label="Amount" type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
        <button type="submit">Transfer</button>
      </form>
      {lastFailure !== undefined && <p role="alert">Transfer {lastFailure.id} failed: {lastFailure.message}</p>}
      <ol aria-label="Transfer log">
        {view.transfers.map((item) => (
          <li key={item.id}>{item.from} → {item.to} {item.amount} (fee {item.fee})</li>
        ))}
      </ol>
    </main>
  );
}
