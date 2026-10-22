# `useFuture(factory, { concurrency })`

비동기 작업을 실행하고, 그 진행 상태를 Model의 상태로 추적합니다.

```ts
function useFuture<Input, Value>(
  factory: (input: Input, context: { signal: AbortSignal; abort(reason?: unknown): void }) => Value | PromiseLike<Value>,
  options: { concurrency: "serial" | "latest" },
): Future<Input, Value>
```

## 인자

- `factory`: `start(input)`마다 실행할 작업.
  - `context.signal`: 이 실행이 취소되면 켜지는 `AbortSignal`. `fetch` 등에 그대로 넘깁니다.
  - `context.abort(reason?)`: 작업 스스로 이 실행을 취소합니다.
- `concurrency`: 실행 중에 또 `start`하면 어떻게 할지. 처음 값에서 바꾸면 오류입니다.
  - `"serial"`: 앞 실행이 끝난 뒤 차례로 실행합니다.
  - `"latest"`: 앞 실행을 취소하고 새로 실행합니다.

## 반환값

Future.

| 멤버 | 하는 일 |
| --- | --- |
| `snapshot()` | 지금 상태: `{ status: "idle" }`, `{ status: "pending" }`, `{ status: "fulfilled", value }`, `{ status: "rejected", reason }` |
| `start(input)` | 실행을 요청하고, 그 실행의 결과를 담은 Promise를 바로 반환합니다. |
| `abort(reason?)` | 진행 중인 실행을 취소합니다. |
| `pending` / `fulfilled` / `rejected` | `subscribe(listener)`로 실행의 시작·성공·실패를 받습니다. 해제 함수를 반환합니다. |

## 동작

- 상태가 바뀌면 Model이 다시 평가되고, 그 뒤 구독자가 불리고, 마지막으로 `start`의 Promise가 끝납니다. `factory`가 바로 값을 반환해도 `pending`을 거칩니다.
- 취소된 실행은 `FutureCancellationError`로 끝납니다. `kind`는 `"explicit"`(`abort`), `"superseded"`(`"latest"`의 새 실행), `"self"`(`context.abort`), `"owner-dispose"`(Model 종료) 중 하나이고, `cause`는 넘긴 `reason`입니다.
- 취소된 실행이 나중에 취소와 관계없는 오류로 reject되면, Future 상태는 그대로 두고 그 오류를 `Behavon.futureDiagnostics.subscribe(listener)`로 알립니다(`{ type: "late-rejection", run, input, cancellation, error }`).
- `start`와 `abort`는 [`useEffect`](./useEffect.md)나 callback 안에서 부릅니다. Model이 종료된 뒤 Future를 쓰면 오류입니다.

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
// 결과값: 처음 "idle", start 뒤 "pending", 응답이 오면 응답 배열을 ", "로 이은 문자열
```
