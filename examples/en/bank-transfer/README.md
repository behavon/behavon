# Bank transfer

Moves money between accounts and charges a fee. If the balance is short, the whole transfer is undone.

## What it shows

- Committing the withdrawal, deposit, fee, and record at once with [`useLabelState` and `transaction`](../../../docs/en/api/transaction.md)
- Deposits and withdrawals of an account (`Account`) each start their own transaction. Called alone, they commit right away; called inside `Bank`'s `transaction.run`, they join `Bank`'s transaction.
- When a withdrawal throws an insufficient-funds error, the error leaves `run` and the whole transaction is rolled back, including the other account's deposit and the transfer record made earlier.
- Failure records that must not be rolled back are kept separately with `useState` and recorded outside `run`

## Files

| File | Role |
| --- | --- |
| [account.ts](./account.ts) | The `Account` Model. Its balance is a `useLabelState`, and its commands are `deposit` and `withdraw`. Insufficient funds is an `InsufficientFundsError`. |
| [bank.ts](./bank.ts) | The `Bank` Model (command `transfer`) and the assembly function `createBank`. |
| [bank-view.tsx](./bank-view.tsx) | Account balances, the transfer form, the last failure, and the transfer log. |
| [bank-transfer.test.ts](./bank-transfer.test.ts) | Checks transfers, rolling back everything on insufficient funds, two transfers in the same tick, invalid input, and using an account alone. |
| [bank-view.test.tsx](./bank-view.test.tsx) | Checks a transfer and a refused transfer on screen. |

## Note

- An account's changes that joined an outer transaction are committed only when `Bank` calls `commit`. The account's own `commit` only marks it finished.

## Usage

```tsx
const { bank, accounts, dispose } = createBank({
  accounts: { kim: { name: "Kim", balance: 10_000 }, lee: { name: "Lee", balance: 0 }, bank: { name: "Fees", balance: 0 } },
  feeAccount: "bank",
  fee: 500,
})
root.render(<BankView bank={bank} accounts={accounts} />)
// after unmounting the screen
dispose()
```
