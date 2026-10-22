# `useLabelState(id, initial)` / `transaction`

Commits or rolls back several state changes at once.

```ts
function useLabelState<State>(id: StateId<State>, initial: State | (() => State)): readonly [State, StateSetter<State>]

const transaction: {
  start(id: TransactionId, states: readonly StateId<unknown>[]): void
  run<Result>(id: TransactionId, body: (access: { get, set }) => Result): Result
  commit(id: TransactionId): void
  rollback(id: TransactionId): void
}
```

## `useLabelState(id, initial)`

The same as [`useState`](./useState.md), but attaches a `StateId` made with [`createId({ name: Behavon.StateType<T>() })`](./createId.md) to the state. Transactions handle only states with a `StateId`. The same `StateId` is separate for each instance.

## `transaction`

| Call | What it does |
| --- | --- |
| `start(id, states)` | Starts with a `TransactionId` made by [`createId()`](./createId.md) and locks `states`. |
| `run(id, body)` | Runs `body` synchronously and returns its result. `body` reads the current value inside the transaction with `get(stateId)` and changes it at once with `set(stateId, next)`. |
| `commit(id)` | Commits the changed values at once and evaluates the Model again right there. |
| `rollback(id)` | Discards the changed values. |

## Behavior

- Call `start`, `run`, `commit`, and `rollback` inside a callback made with [`useCallback`](./useCallback.md).
- If an error leaves `run`, the transaction is rolled back and ended, and the error is thrown as is.
- If the evaluation of `commit` fails, the Model is terminated and `commit` throws the error.
- Locked states are changed only with `set` inside `run`. Calling their setter outside the transaction applies after the transaction ends.
- A `useState` setter or `useReducer` dispatch called inside `run` is not part of the transaction and applies separately after it ends. In development mode, it prints a warning.
- When another Model starts its own transaction inside `run`, it joins the outer transaction and is committed together at the outermost `commit`.
- If the Model is terminated without ending the transaction, the changes are discarded.

## Example

```ts
import Behavon, { type Model, type Signal } from "behavon"

const states = Behavon.createId({
  from: Behavon.StateType<number>(),
  to: Behavon.StateType<number>(),
})

interface AccountsPort {
  transfer: Signal<[amount: number]>
}

const accountsPort = Behavon.createPort<AccountsPort>({ transfer: Behavon.SignalType() })

const Accounts: Model<undefined, string, AccountsPort> = () => {
  const [from] = Behavon.useLabelState(states.from, 100)
  const [to] = Behavon.useLabelState(states.to, 0)

  const transfer = Behavon.useCallback((amount: number) => {
    const id = Behavon.createId()
    Behavon.transaction.start(id, [states.from, states.to])
    const enough = Behavon.transaction.run(id, ({ get, set }) => {
      set(states.from, n => n - amount)
      set(states.to, n => n + amount)
      return get(states.from) >= 0
    })
    if (enough) Behavon.transaction.commit(id)
    else Behavon.transaction.rollback(id)
  }, [])
  Behavon.useSignal(accountsPort, "transfer", transfer)
  Behavon.useExport(accountsPort, "transfer")

  return `${from} / ${to}`
}

const accounts = Behavon.createModel(Accounts, undefined)
accounts.transfer(30) // result: "70 / 30"
accounts.transfer(100) // not enough balance, rolled back. The result stays "70 / 30"
```
