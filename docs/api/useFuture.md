# `useFuture(factory, { concurrency })`

비동기 작업을 실행하고 진행 상태를 추적하는 Future를 반환합니다.

```ts
function useFuture<Input, Value>(
  factory: (input: Input, context: { signal: AbortSignal; abort(reason?: unknown): void }) => Value | PromiseLike<Value>,
  options: { concurrency: "serial" | "latest" },
): Future<Input, Value>
```

- `factory`: `start(input)`을 호출할 때마다 실행할 작업.
  - `context.signal`: 이 실행이 취소되면 abort되는 `AbortSignal`. `fetch` 등에 그대로 넘깁니다.
  - `context.abort(reason?)`: 작업 스스로 이 실행을 취소합니다.
- `concurrency`: 실행 중에 또 `start`하면 어떻게 할지 정합니다. 처음 정한 값을 바꾸면 오류입니다.
  - `"serial"`: 앞 실행이 끝난 뒤 차례대로 실행합니다.
  - `"latest"`: 앞 실행을 취소하고 새 실행을 시작합니다.

## Future

| 멤버 | 하는 일 |
| --- | --- |
| `snapshot()` | 현재 상태. `{ status: "idle" }`, `{ status: "pending" }`, `{ status: "fulfilled", value }`, `{ status: "rejected", reason }` 중 하나입니다. |
| `start(input)` | 실행을 시작하고, 그 실행의 결과를 담은 Promise를 바로 반환합니다. |
| `abort(reason?)` | 실행 중인 작업을 취소합니다. 실행 중이 아니면 아무 일도 하지 않습니다. |
| `pending.subscribe(listener)` | 실행이 시작될 때 `{ run, input }`을 받습니다. |
| `fulfilled.subscribe(listener)` | 성공했을 때 `{ run, input, value }`를 받습니다. |
| `rejected.subscribe(listener)` | 실패하거나 취소됐을 때 `{ run, input, reason }`을 받습니다. |

`subscribe`는 해제 함수를 반환합니다. 상태가 바뀌면 Model이 다시 평가되고, 그 다음에 구독자가 호출되고, 마지막으로 `start`의 Promise가 끝납니다. `factory`가 바로 값을 반환해도 `pending`을 거칩니다.

`start`와 `abort`는 [`useEffect`](./useEffect.md)나 callback 안에서 호출합니다. 개발 모드에서는 Model 본문에서 호출하면 경고를 출력합니다. Model이 종료된 뒤 Future를 쓰면 오류입니다.

## 취소

취소된 실행의 Promise와 `rejected`의 `reason`은 `FutureCancellationError`입니다.

```ts
class FutureCancellationError extends Error {
  readonly kind: "explicit" | "superseded" | "self" | "owner-dispose"
  readonly cause: unknown // abort에 넘긴 reason
}
```

| `kind` | 원인 |
| --- | --- |
| `"explicit"` | `future.abort(reason)` |
| `"superseded"` | `"latest"`에서 새 `start`가 앞 실행을 대체함 |
| `"self"` | `factory`의 `context.abort(reason)` |
| `"owner-dispose"` | Model 종료 |

## `futureDiagnostics`

취소된 실행이 나중에 취소와 관계없는 오류로 reject되면, 그 오류는 Future 상태를 바꾸지 않고 `Behavon.futureDiagnostics`로 전달됩니다.

```ts
const unsubscribe = Behavon.futureDiagnostics.subscribe(diagnostic => {
  // diagnostic: { type: "late-rejection", run, input, cancellation, error }
  console.error(diagnostic.error)
})
```

## 예제

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
// 결과값: 처음 "idle", Effect에서 start가 실행되면 "pending", 응답이 오면 응답 배열을 ", "로 이은 문자열
```
