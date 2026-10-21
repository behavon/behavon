# `createResource(definition)` / `useResource(type, input)`

WebSocket이나 stream처럼 열고 닫아야 하는 외부 자원을 관리합니다.

## `createResource(definition)`

자원을 다루는 방법을 정의합니다. 모듈 최상위에서 호출합니다.

```ts
function createResource(definition: {
  open(context: { input: Input; signal: AbortSignal; terminated(reason: Reason): void }): Resource | PromiseLike<Resource>
  close(context: { resource: Resource; reason: Reason | undefined }): void | PromiseLike<void>
  abort(context: { resource: Resource | undefined; reason: Reason | undefined }): void | PromiseLike<void>
  actions?: { [name: string]: (context: { resource: Resource; signal: AbortSignal }, ...args: any[]) => unknown }
  onCleanupError?(error: unknown, context: { command: "abort" | "dispose" | "closeFailed"; reason: Reason | undefined }): void
}): ResourceType
```

| 항목 | 하는 일 |
| --- | --- |
| `open` | 자원을 엽니다. 자원이 바깥 사정으로 끊기면 `terminated(reason)`을 호출합니다. `signal`은 여는 도중 `abort()`되거나 Model이 종료되면 켜지는 취소 신호(`AbortSignal`)입니다. |
| `close` | 정상적으로 닫습니다. |
| `abort` | 강제로 끊습니다. 아직 열리는 중이면 `resource`가 `undefined`일 수 있습니다. |
| `actions` | 열린 자원으로 할 동작. controller에 같은 이름의 함수로 붙습니다. `signal`은 `abort()`, Model 종료, `terminated` 호출로 자원이 무효가 되면 켜지는 취소 신호(`AbortSignal`)입니다. 정상 `close()`로는 켜지지 않고, 진행 중인 action이 끝난 뒤 닫힙니다. |
| `onCleanupError` | `abort`나 정리 작업이 실패했을 때 오류를 받습니다. |

`open`과 `actions`의 `signal`은 표준 `AbortSignal`이므로 `fetch` 등에 그대로 넘깁니다. 타입은 `ResourceAbortSignal`이고, 브라우저나 Node처럼 `AbortSignal` 타입이 있는 환경에서는 `AbortSignal`과 같습니다.

## `useResource(type, input)`

정의한 자원을 이 Model이 소유하게 합니다. 현재 상태와 controller를 반환합니다.

```ts
function useResource(type: ResourceType, input: Input): readonly [snapshot: ResourceSnapshot, controller: ResourceController]
```

- `input`: 다음에 `open()`할 때 `open`에 넘길 값. input이 바뀌어도 자원을 다시 열지는 않습니다.

### snapshot

| `phase` | 의미 |
| --- | --- |
| `"closed"` | 닫힘. `closedBy`와 `reason`이 함께 있습니다. |
| `"opening"` | 여는 중 |
| `"open"` | 열림 |
| `"closing"` | 닫는 중 |

`closedBy`는 닫힌 이유입니다: `"initial"`(아직 연 적 없음), `"close"`, `"openFailed"`, `"closeFailed"`, `"abort"`, `"lost"`(`terminated` 호출).

### controller

| 멤버 | 하는 일 |
| --- | --- |
| `open()` | 자원을 엽니다. |
| `close(reason?)` | 정상적으로 닫습니다. `reason`은 snapshot의 `reason`이 됩니다. |
| `abort(reason?)` | 강제로 끊습니다. |
| `<action>(...args)` | `actions`에 정의한 동작. 자원이 열려 있지 않으면 오류입니다. |
| `opened`, `closed`, `lost` 등 | 상태 변화를 구독하는 `subscribe(listener)`. 아래 목록을 보세요. |

`open`·`close`·`abort`는 요청 객체를 바로 반환합니다. `request.getResult()`로 결과를 읽습니다.

| `getResult()` | 의미 |
| --- | --- |
| `{ status: "pending" }` | 아직 끝나지 않음 |
| `{ status: "succeeded", outcome }` | 성공. `outcome`은 `"opened"`, `"alreadyOpen"`, `"closed"`, `"alreadyClosed"`, `"aborted"`, `"alreadyAborted"` 중 하나 |
| `{ status: "failed", error }` | 실패 |
| `{ status: "superseded", by }` | 다른 요청이 대신함 |

요청 객체의 `execution`은 `"started"`, `"queued"`, `"coalesced"`, `"alreadySatisfied"` 중 하나입니다.

구독할 수 있는 이름은 `openRequested`, `openStarted`, `opened`, `openFailed`, `closeRequested`, `closeStarted`, `closed`, `closeFailed`, `abortRequested`, `aborted`, `lost`입니다. 각 `subscribe`는 해제 함수를 반환합니다.

`actions`가 Promise를 반환하는 동안 `abort`나 종료로 자원이 무효가 되면, 그 Promise는 나중에 끝날 때 `ResourceActionSupersededError`로 reject됩니다. 무효가 된 시점에 바로 reject되지는 않습니다. 그래서 action은 `signal`이 켜지면 반환한 Promise를 끝내야 합니다. 끝내지 않으면 controller의 action Promise도 계속 대기합니다.

Model이 종료되면 `abort`가 호출되어 자원이 정리됩니다. `open`·`close`·`abort`는 [`useEffect`](./useEffect.md)나 callback 안에서 호출합니다.

## 예제

```ts
import Behavon, { type Model, type Signal } from "behavon"

const Socket = Behavon.createResource({
  open: ({ input, terminated }: { input: { readonly url: string }; terminated(reason: string): void }) =>
    new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(input.url)
      socket.addEventListener("open", () => resolve(socket), { once: true })
      socket.addEventListener("error", () => reject(new Error("connection failed")), { once: true })
      socket.addEventListener("close", () => terminated("server closed"))
    }),
  close: ({ resource }) => resource.close(),
  abort: ({ resource }) => resource?.close(),
  actions: {
    send: ({ resource }: { resource: WebSocket }, message: string) => resource.send(message),
  },
})

interface ChatPort {
  send: Signal<[message: string]>
}

const chatPort = Behavon.createPort<ChatPort>({ send: Behavon.SignalType() })

const Chat: Model<{ readonly url: string }, string, ChatPort> = (input) => {
  const [snapshot, socket] = Behavon.useResource(Socket, input)
  Behavon.useEffect(() => {
    socket.open()
    return () => {
      socket.abort()
    }
  }, [socket])
  const send = Behavon.useCallback((message: string) => socket.send(message), [socket])
  Behavon.useSignal(chatPort, "send", send)
  Behavon.useExport(chatPort, "send")
  return snapshot.phase
}

const chat = Behavon.createModel(Chat, { url: "wss://example.com/chat" })
// 결과값: 처음 "opening", 연결되면 "open"
// 연결된 뒤 chat.send("hello")로 메시지를 보냅니다. 연결 전에 부르면 오류입니다
```
