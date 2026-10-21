# 거래소 시뮬레이션

가상의 종목과 투자자가 단계마다 주문을 내는 거래소입니다. 같은 시나리오(seed)로 돌리면 언제나 같은 결과가 나옵니다.

## 보여 주는 기능

- 많은 Model로 이루어진 graph. 기본 시나리오는 13개입니다: 시계(`Clock`) 1, 거래소(`Exchange`) 1, 회사(`Company`) 3, 투자자(`Trader`) 4, 계좌(`Portfolio`) 4.
- 회사와 투자자는 자기 Slot을 시계의 Signal에 직접 [`useConnect`](../../docs/api/useConnect.md)합니다. 수가 정해져 있지 않아도 연결용 Model이 따로 필요 없습니다.
- 한 단계는 `advance` 안에서 동기로 끝남
  1. `ticked`로 모든 회사에 알리고, 요청 객체의 `report`로 가격을 모음
  2. `opened`로 모든 투자자에게 가격을 보내고, `submit`으로 주문을 모음
  3. 투자자 순서로 정렬한 주문을 거래소의 `execute`에 넘김
- 재현: 회사의 가격 변화와 투자자의 판단은 seed로 정해지는 의사 난수(`random.ts`)만 씁니다. 참여자마다 seed를 따로 나누므로, 응답 순서와 관계없이 결과가 같습니다.
- 주문 처리 transaction: 주문 하나가 transaction 하나입니다. 체결 기록(`useLabelState`)과 계좌의 현금·보유 수량을 함께 바꾸고, 계좌가 거부(`OrderRefusedError`)하면 셋 다 되돌려집니다. 거부 기록은 `useState`로 `run` 밖에서 남깁니다.
- 화면에는 화면이 쓰는 항목만 담은 `ClockScreenPort`(`step`, `advance`) 타입으로 넘김

## 구성

| 파일 | 역할 |
| --- | --- |
| [scenario.ts](./scenario.ts) | 시나리오, 주문, 단계마다 보내는 요청(`TickRequest`, `MarketRequest`) 타입과 기본 시나리오. |
| [random.ts](./random.ts) | seed 기반 의사 난수와 참여자별 seed. |
| [clock.ts](./clock.ts) | `Clock` Model. 명령 `advance`, 단계 snapshot. |
| [company.ts](./company.ts) | `Company` Model. 단계마다 가격을 움직여 보고합니다. |
| [trader.ts](./trader.ts) | `Trader` Model. 전략은 추세(`momentum`)·역추세(`contrarian`)·무작위(`random`). 단계마다 주문은 최대 하나입니다. |
| [portfolio.ts](./portfolio.ts) | `Portfolio` Model. 현금과 보유 수량, `buy`·`sell`. |
| [exchange.ts](./exchange.ts) | `Exchange` Model. 주문 체결, 가격, 체결·거부 기록. |
| [simulation.ts](./simulation.ts) | 조립 함수 `createSimulation`과 처음부터 N단계를 돌리는 `runSimulation`. |
| [market-view.tsx](./market-view.tsx) | 단계, 다음 단계 버튼, 가격, 투자자, 이번 단계의 체결과 거부. |
| [market-simulation.test.ts](./market-simulation.test.ts) | 같은 seed의 같은 결과, 다른 seed의 다른 결과, 계좌와 체결 기록의 일치, 거부된 주문의 흔적 없음, 잘못된 주문, 한 투자자의 연속 주문을 확인합니다. |
| [market-view.test.tsx](./market-view.test.tsx) | 화면에서 한 단계를 진행합니다. |

## 주의

- 단계 사이에는 다시 평가될 시간을 줘야 합니다(`runSimulation`은 단계마다 `setTimeout(0)`을 기다립니다). 결과 snapshot은 다시 평가된 뒤에 발행됩니다.
- 한 transaction 안에서 같은 state를 두 번 바꾸면 두 번째 확인이 확정 전 값을 보지 못합니다. 그래서 주문마다 transaction을 따로 둡니다. 확정된 뒤의 다음 주문은 바뀐 잔액으로 확인됩니다.
## 사용

```tsx
const simulation = createSimulation(defaultScenario)
root.render(<MarketView clock={simulation.clock} views={simulation.views} />)
// 화면을 내린 뒤
simulation.dispose()

// 화면 없이 재현
const result = await runSimulation(defaultScenario, 30)
```

## 상태

완료
