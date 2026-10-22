# Quote request

Asks several suppliers for quotes at once and collects the answers. Answers pile up in arrival order, and the offer with the lowest total is shown.

## What it shows

- Connecting one Signal (`quoteRequested`) to a Slot (`quote`) on each supplier with [`useConnect`](../../../docs/en/api/useConnect.md)
- Sending a request object carrying the answer function `reply`, and piling up the suppliers' async answers in state
- Dropping late answers to an earlier request once a new request is sent. Each request gets a number (`round`), and `reply` compares the numbers in the updater of the state setter.
- The number of suppliers is not fixed, so the connection is made by a `QuoteLink` Model created per supplier. Hooks cannot be called inside a loop.
- The screen receives it as the `QuoteScreenPort` (`view`, `request`) type

## Files

| File | Role |
| --- | --- |
| [quote.ts](./quote.ts) | The request (`QuoteRequest`) and answer (`QuoteAnswer`: offer, not available, error) types. |
| [supplier.ts](./supplier.ts) | The `Supplier` Model. Its input is a name and the price function `priceOf`. |
| [quote-board.ts](./quote-board.ts) | The `QuoteBoard` Model, the connecting `QuoteLink` Model, and the assembly function `createQuoteRequest`. |
| [quote-view.tsx](./quote-view.tsx) | Item and quantity input, the answer list, and the lowest price. |
| [fake-price-source.ts](./fake-price-source.ts) | A test price list you answer by hand. |
| [quote-request.test.ts](./quote-request.test.ts) | Checks delivery to every supplier, arrival order, the lowest price, new requests and late answers, two requests in the same tick, invalid input, and answers after termination. |
| [quote-view.test.tsx](./quote-view.test.tsx) | Checks requesting and the answers and lowest price on screen. |

## Note

- The answer function `reply` can be called after a new request, or after `QuoteBoard` is terminated. So inside `reply`, only the `useState` setter is used, not a [`useMutable`](../../../docs/en/api/useMutable.md) handle. A `useMutable` handle of a terminated Model throws, while a setter does nothing.

## Usage

```tsx
const { board, dispose } = createQuoteRequest([
  { name: "Ganada", priceOf: (item, quantity) => fetchPrice("ganada", item, quantity) },
  { name: "Dara", priceOf: (item, quantity) => fetchPrice("dara", item, quantity) },
])
root.render(<QuoteView board={board} />)
// after unmounting the screen
dispose()
```
