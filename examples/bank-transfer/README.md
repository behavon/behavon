# 계좌 이체

계좌 사이에 금액을 옮기고 수수료를 받습니다. 잔액이 모자라면 이체 전체가 없던 일이 됩니다.

## 보여 주는 기능

- [`useLabelState`와 `transaction`](../../docs/api/transaction.md)으로 출금·입금·수수료·기록을 한 번에 확정
- 계좌(`Account`)의 입금·출금은 각자 transaction을 시작합니다. 혼자 불리면 바로 확정되고, `Bank`의 `transaction.run` 안에서 불리면 `Bank`의 transaction에 합류합니다.
- 출금이 잔액 부족 오류를 던지면 오류가 `run` 밖으로 나가면서 transaction 전체가 되돌려짐. 먼저 실행한 다른 계좌의 입금과 이체 기록도 함께 되돌려집니다.
- 되돌려지면 안 되는 실패 기록은 `useState`로 따로 두고 `run` 밖에서 기록

## 구성

| 파일 | 역할 |
| --- | --- |
| [account.ts](./account.ts) | `Account` Model. 잔액은 `useLabelState`, 명령은 `deposit`·`withdraw`. 잔액 부족은 `InsufficientFundsError`. |
| [bank.ts](./bank.ts) | `Bank` Model(명령 `transfer`)과 조립 함수 `createBank`. |
| [bank-view.tsx](./bank-view.tsx) | 계좌 잔액, 이체 폼, 마지막 실패, 이체 기록. |
| [bank-transfer.test.ts](./bank-transfer.test.ts) | 이체, 잔액 부족 시 전체 되돌림, 같은 tick의 두 이체, 잘못된 입력, 계좌 단독 사용을 확인합니다. |
| [bank-view.test.tsx](./bank-view.test.tsx) | 화면에서 이체하고, 거절된 이체를 확인합니다. |

## 주의

- callback이 읽는 `useLabelState` 값은 마지막으로 확정된 값입니다. 같은 transaction 안에서 먼저 바꾼 값은 보이지 않습니다. 그래서 한 이체 안에서 같은 계좌를 두 번 바꾸지 않습니다. 출금은 금액과 수수료를 합쳐 한 번만 합니다.
- 바깥 transaction에 합류한 계좌의 변경은 `Bank`가 `commit`해야 확정됩니다. 계좌 쪽의 `commit`은 끝났다는 표시만 합니다.

## 사용

```tsx
const { bank, accounts, dispose } = createBank({
  accounts: { kim: { name: "김", balance: 10_000 }, lee: { name: "이", balance: 0 }, bank: { name: "수수료", balance: 0 } },
  feeAccount: "bank",
  fee: 500,
})
root.render(<BankView bank={bank} accounts={accounts} />)
// 화면을 내린 뒤
dispose()
```

## 상태

완료
