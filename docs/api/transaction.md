# `useLabelState(id, initial)` / `transaction`

여러 state 변경을 한 번에 확정하거나 한 번에 되돌립니다.

```ts
function useLabelState<State>(id: StateId<State>, initial: State | (() => State)): readonly [State, StateSetter<State>]

const transaction: {
  start(id: TransactionId, states: readonly StateId<unknown>[]): void
  run<Result>(id: TransactionId, body: () => Result): Result
  commit(id: TransactionId): void
  rollback(id: TransactionId): void
}
```

## `useLabelState(id, initial)`

[`useState`](./useState.md)와 같지만 state에 `StateId`를 붙입니다. `StateId`가 붙은 state만 transaction으로 묶을 수 있습니다.

- `id`: [`createId({ name: Behavon.StateType<T>() })`](./createId.md)로 만든 `StateId`. 모듈 최상위에서 만듭니다.
- `initial`: 처음 값. 함수를 넘기면 처음 한 번만 호출합니다.
- 같은 `StateId`를 다른 instance가 쓰면 instance마다 따로입니다. 한 instance 안에서 같은 `StateId`를 두 번 쓰면 오류입니다.

## `transaction`

| 호출 | 하는 일 |
| --- | --- |
| `transaction.start(id, states)` | `Behavon.createId()`로 만든 `TransactionId`로 transaction을 시작하고 `states`를 잠급니다. |
| `transaction.run(id, body)` | `body` 안의 `useLabelState` setter 호출을 transaction에 담고, `body`의 반환값을 돌려줍니다. `body`는 동기 함수여야 합니다. |
| `transaction.commit(id)` | 담은 변경을 한 번에 확정합니다. |
| `transaction.rollback(id)` | 담은 변경을 버립니다. |

규칙은 다음과 같습니다.

- `start`·`run`·`commit`·`rollback`은 [`useCallback`](./useCallback.md)으로 만든 callback 안에서 호출합니다. Model 본문에서 호출하면 오류입니다.
- `run` 안에서 `transaction.start`에 넣지 않은 `useLabelState` state의 setter를 부르면 오류입니다.
- `run`에서 오류가 밖으로 나가면 그 transaction은 되돌려지고 끝나며, 오류는 그대로 다시 던져집니다. 그 뒤의 `commit`·`rollback`은 오류입니다.
- `body`가 Promise를 반환하면 오류입니다.
- `run` 안에서 부른 setter의 변경은 `commit` 때 차례로 적용됩니다. 함수를 넘기면(`set(last => next)`) 그 함수도 `commit` 때 실행되며, 앞선 변경이 반영된 값을 받습니다. 그래서 `run` 안에서는 확정 전의 값을 읽을 수 없습니다. callback이 읽는 state는 마지막으로 확정된 값입니다.
- setter에 넘긴 함수가 오류를 던지면 `commit`이 그 오류를 던지고 Model이 종료됩니다. 거부할 조건은 setter 함수 안이 아니라 `run` 안에서 확인하고 오류를 던집니다.
- 다른 transaction이 잠근 state를 잠그려 하면 오류입니다.
- 잠긴 state의 setter를 transaction 밖에서 부르면, transaction이 끝난 뒤에 적용됩니다.
- `run` 안에서 [`useState`](./useState.md) setter나 [`useReducer`](./useReducer.md) dispatch를 부르면 transaction에 담기지 않고 transaction이 끝난 뒤 따로 적용됩니다. 되돌려지지 않습니다. 개발 모드에서는 경고를 출력합니다.
- `run` 안에서 다른 Model의 callback이 자기 `TransactionId`로 `start`하면, 그 transaction은 바깥 transaction의 일부가 됩니다. 안쪽 `commit`은 끝났다는 표시만 하고, 변경은 가장 바깥 `commit`에서 한 번에 확정됩니다.
- 한 instance 안에서 같은 `TransactionId`를 다시 `start`하면 오류입니다.
- transaction을 끝내지 않은 채 Model이 종료되면 변경은 버려집니다.

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
  const [from, setFrom] = Behavon.useLabelState(states.from, 100)
  const [to, setTo] = Behavon.useLabelState(states.to, 0)

  const transfer = Behavon.useCallback((amount: number) => {
    const id = Behavon.createId()
    Behavon.transaction.start(id, [states.from, states.to])
    Behavon.transaction.run(id, () => {
      setFrom(n => n - amount)
      setTo(n => n + amount)
    })
    if (from - amount < 0) Behavon.transaction.rollback(id)
    else Behavon.transaction.commit(id)
  }, [from, setFrom, setTo])
  Behavon.useSignal(accountsPort, "transfer", transfer)
  Behavon.useExport(accountsPort, "transfer")

  return `${from} / ${to}`
}

const accounts = Behavon.createModel(Accounts, undefined)
accounts.transfer(30)
```
