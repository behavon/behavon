# Search

Searches on every keystroke and cancels the previous search that has not finished yet.

## What it shows

- `"latest"` of [`useFuture`](../../../docs/en/api/useFuture.md): a new search cancels the previous one
- Passing each run's cancellation signal (`AbortSignal`, the factory's `context.signal`) to the server call, so a cancelled request actually stops
- An activity log (start, done, cancelled, failed) from the `pending`, `fulfilled`, and `rejected` subscriptions
- Telling cancellation apart from failure with `FutureCancellationError`
- Keeping the previous results on screen while a new search runs. Clearing the search term calls `abort()` on the search in progress

## Files

| File | Role |
| --- | --- |
| [search.ts](./search.ts) | The `Search` Model. Its input is a `SearchApi`. The status is `idle`, `searching`, `done`, or `failed`. |
| [search-view.tsx](./search-view.tsx) | Shows the search box, status, results, and log. |
| [fake-search-api.ts](./fake-search-api.ts) | A test server you answer by hand. You can check whether the cancellation signal (`AbortSignal`) of each request turned on. |
| [search.test.ts](./search.test.ts) | Checks cancellation, log order, keeping previous results, an empty search term, failure, and termination. |
| [search-view.test.tsx](./search-view.test.tsx) | Checks searching while typing on screen. |

## Usage

```tsx
const search = Behavon.createModel(Search, api)
root.render(<SearchView search={search} />)
// after unmounting the screen
search.dispose() // the request in progress is cancelled too
```
