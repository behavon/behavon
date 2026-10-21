# `boundary(model)`

Model의 오류를 결과값으로 바꾸는 새 Model을 반환합니다. React의 Error Boundary와 같은 역할입니다.

```ts
function boundary<Input, Output>(model: Model<Input, Output>): Model<Input, BoundaryState<Output>>
```

새 Model의 결과값은 둘 중 하나입니다.

- `{ status: "active", output }`: 내부 Model이 정상입니다.
- `{ status: "failed", error, reset }`: 내부 Model에서 오류가 났습니다. `reset()`을 호출하면 최신 input으로 내부 Model을 새로 만들어 다시 시도합니다.

잡는 오류는 내부 Model의 평가 오류와, 내부 Model의 Effect 실행·정리 오류입니다. Effect 오류는 다음 microtask에 `failed`로 바뀝니다. 한 번에 여러 오류가 나면 `error`는 `AggregateError`입니다. `boundary`가 없으면 오류는 instance 전체를 종료합니다.

- `boundary(model)`은 Model을 실행하지 않고 새 Model 함수만 반환합니다. [`createModel`](./createModel.md)로 실행합니다.
- input은 내부 Model에 그대로 전달됩니다. `null`도 일반 값입니다.
- 실패 상태에서 input을 바꿔도 자동으로 다시 시도하지 않습니다.
- 오래된 `reset`이나 종료된 instance의 `reset`은 아무 일도 하지 않습니다.
- 바깥 instance를 `dispose()`하면 내부 Model도 함께 종료됩니다.
- 내부 Model이 [`useExport`](./useExport.md)로 연 Signal과 snapshot, Port의 Slot은 바깥 instance에 없습니다. 바깥 instance에서 부르면 오류입니다.

## 예제

```ts
import Behavon, { type Model, type Signal } from "behavon"

function Risky(n: number): number {
  if (n < 0) throw new Error("negative")
  return n
}

const Safe = Behavon.boundary(Risky)
const safe = Behavon.createModel(Safe, -1)

interface WatcherPort {
  retry: Signal
}

const watcherPort = Behavon.createPort<WatcherPort>({ retry: Behavon.SignalType() })

const Watcher: Model<undefined, string, WatcherPort> = () => {
  const [state] = Behavon.useModel(safe)
  const retry = Behavon.useCallback(() => {
    if (state.status === "failed") state.reset()
  }, [state])
  Behavon.useSignal(watcherPort, "retry", retry)
  Behavon.useExport(watcherPort, "retry")
  return state.status
}

const watcher = Behavon.createModel(Watcher, undefined)
watcher.retry()
```
