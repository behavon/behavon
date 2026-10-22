# `useLabelState(id, initial)` / `transaction`

여러 state 변경을 한 번에 확정하거나 한 번에 되돌립니다.

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

[`useState`](./useState.md)와 같지만 state에 [`createId({ name: Behavon.StateType<T>() })`](./createId.md)로 만든 `StateId`를 붙입니다. transaction은 `StateId`가 붙은 state만 다룹니다. 같은 `StateId`라도 instance마다 따로입니다.

## `transaction`

| 호출 | 하는 일 |
| --- | --- |
| `start(id, states)` | [`createId()`](./createId.md)로 만든 `TransactionId`로 시작하고 `states`를 잠급니다. |
| `run(id, body)` | `body`를 동기로 실행하고 반환값을 돌려줍니다. `body`는 `get(stateId)`로 transaction 안의 지금 값을 읽고, `set(stateId, next)`로 바로 바꿉니다. |
| `commit(id)` | 바꾼 값을 한 번에 확정하고, 그 자리에서 Model을 다시 평가합니다. |
| `rollback(id)` | 바꾼 값을 버립니다. |

## 동작

- `start`·`run`·`commit`·`rollback`은 [`useCallback`](./useCallback.md)으로 만든 callback 안에서 부릅니다.
- `run`에서 오류가 나가면 transaction은 되돌려지고 끝나며, 오류는 그대로 throw됩니다.
- `commit`의 평가가 실패하면 Model이 종료되고 `commit`이 그 오류를 throw합니다.
- 잠긴 state는 `run` 안에서 `set`으로만 바꿉니다. transaction 밖에서 그 setter를 부르면 transaction이 끝난 뒤 적용됩니다.
- `run` 안에서 부른 `useState` setter나 `useReducer` dispatch는 transaction에 담기지 않고 끝난 뒤 따로 적용됩니다. 개발 모드에서는 경고를 출력합니다.
- `run` 안에서 다른 Model이 자기 transaction을 `start`하면 바깥 transaction에 합류하고, 가장 바깥 `commit`에서 함께 확정됩니다.
- transaction을 끝내지 않고 Model이 종료되면 변경은 버려집니다.

## 예제

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
accounts.transfer(30) // 결과값: "70 / 30"
accounts.transfer(100) // 잔액이 모자라 되돌림. 결과값은 그대로 "70 / 30"
```
