# 견적 요청

여러 공급자에게 한 번에 견적을 요청하고 응답을 모읍니다. 응답은 도착한 순서대로 쌓이고, 제안 중 합계가 가장 낮은 것을 보여 줍니다.

## 보여 주는 기능

- 하나의 Signal(`quoteRequested`)을 공급자마다 있는 Slot(`quote`)에 [`useConnect`](../../../docs/ko/api/useConnect.md)
- 요청 객체에 응답 함수 `reply`를 담아 보내고, 공급자가 비동기로 응답하면 state에 차례로 쌓기
- 새 요청을 보내면 이전 요청에 늦게 도착한 응답은 버림. 요청마다 번호(`round`)를 붙이고, `reply`는 state setter의 updater에서 번호를 비교합니다.
- 공급자 수가 정해져 있지 않으므로, 연결은 공급자마다 하나씩 만드는 `QuoteLink` Model이 맡음. Hook은 반복문 안에서 부를 수 없습니다.
- 화면에는 `QuoteScreenPort`(`view`, `request`) 타입으로 넘김

## 구성

| 파일 | 역할 |
| --- | --- |
| [quote.ts](./quote.ts) | 요청(`QuoteRequest`)과 응답(`QuoteAnswer`: 제안·공급 불가·오류) 타입. |
| [supplier.ts](./supplier.ts) | `Supplier` Model. input은 이름과 가격표 함수 `priceOf`입니다. |
| [quote-board.ts](./quote-board.ts) | `QuoteBoard` Model, 연결용 `QuoteLink` Model, 조립 함수 `createQuoteRequest`. |
| [quote-view.tsx](./quote-view.tsx) | 품목·수량 입력, 응답 목록, 최저가. |
| [fake-price-source.ts](./fake-price-source.ts) | 가격을 직접 응답하는 테스트용 가격표. |
| [quote-request.test.ts](./quote-request.test.ts) | 모든 공급자에게 전달, 도착 순서, 최저가, 새 요청과 늦은 응답, 같은 tick의 두 요청, 잘못된 입력, 종료 뒤 응답을 확인합니다. |
| [quote-view.test.tsx](./quote-view.test.tsx) | 화면에서 요청하고 응답과 최저가를 확인합니다. |

## 주의

- 응답 함수 `reply`는 새 요청 뒤나 `QuoteBoard`가 종료된 뒤에도 불릴 수 있습니다. 그래서 `reply` 안에서는 [`useMutable`](../../../docs/ko/api/useMutable.md) handle을 쓰지 않고 `useState` setter만 씁니다. 종료된 Model의 `useMutable` handle은 오류를 내고, setter는 아무 일도 하지 않습니다.

## 사용

```tsx
const { board, dispose } = createQuoteRequest([
  { name: "가나상사", priceOf: (item, quantity) => fetchPrice("ganada", item, quantity) },
  { name: "다라유통", priceOf: (item, quantity) => fetchPrice("dara", item, quantity) },
])
root.render(<QuoteView board={board} />)
// 화면을 내린 뒤
dispose()
```
