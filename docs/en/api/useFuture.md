# `useFuture(factory, { concurrency })`

Runs async work and tracks its progress as Model state.

```ts
function useFuture<Input, Value>(
  factory: (input: Input, context: { signal: AbortSignal; abort(reason?: unknown): void }) => Value | PromiseLike<Value>,
  options: { concurrency: "serial" | "latest" },
): Future<Input, Value>
```

## Parameters

- `factory`: the work to run on each `start(input)`.
  - `context.signal`: an `AbortSignal` that turns on when this run is cancelled. Pass it as is to `fetch` and the like.
  - `context.abort(reason?)`: the work cancels its own run.
- `concurrency`: what to do on `start` while a run is in progress. Changing it from the first value is an error.
  - `"serial"`: runs one after another once the previous run ends.
  - `"latest"`: cancels the previous run and starts the new one.

## Returns

A Future.

| Member | What it does |
| --- | --- |
| `snapshot()` | The current state: `{ status: "idle" }`, `{ status: "pending" }`, `{ status: "fulfilled", value }`, or `{ status: "rejected", reason }` |
| `start(input)` | Requests a run and immediately returns a Promise of that run's result. |
| `abort(reason?)` | Cancels the run in progress. |
| `pending` / `fulfilled` / `rejected` | `subscribe(listener)` receives each run's start, success, and failure. It returns a function that removes the listener. |

## Behavior

- When the state changes, the Model is evaluated again, then the subscribers are called, and finally the Promise of `start` settles. Even if `factory` returns a value right away, the run goes through `pending`.
- A cancelled run ends with a `FutureCancellationError`. Its `kind` is `"explicit"` (`abort`), `"superseded"` (a new run under `"latest"`), `"self"` (`context.abort`), or `"owner-dispose"` (the Model was terminated), and its `cause` is the `reason` passed.
- If a cancelled run later rejects with an error unrelated to the cancellation, the Future state is left as is and the error is reported through `Behavon.futureDiagnostics.subscribe(listener)` (`{ type: "late-rejection", run, input, cancellation, error }`).
- Call `start` and `abort` inside [`useEffect`](./useEffect.md) or a callback. Using a Future after its Model is terminated is an error.

## Example

```ts
function Search(query: string): string {
  const search = Behavon.useFuture(async (text: string, { signal }) => {
    const response = await fetch(`/search?q=${encodeURIComponent(text)}`, { signal })
    return (await response.json()) as readonly string[]
  }, { concurrency: "latest" })
  const result = search.snapshot()

  Behavon.useEffect(() => {
    void search.start(query)
  }, [query, search])

  Behavon.useEffect(() => {
    return search.rejected.subscribe(({ input, reason }) => console.warn(input, reason))
  }, [search])

  return result.status === "fulfilled" ? result.value.join(", ") : result.status
}

const search = Behavon.createModel(Search, "behavon")
// result: "idle" at first, "pending" after start, then the response array joined with ", " when the response arrives
```
