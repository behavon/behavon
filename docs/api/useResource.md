# `createResource(definition)` / `useResource(type, input)`

WebSocket이나 stream처럼 열고 닫는 외부 자원을 Model이 소유하게 합니다.

```ts
function createResource(definition: {
  open(context: { input: Input; signal: AbortSignal; terminated(reason: Reason): void }): Resource | PromiseLike<Resource>
  close(context: { resource: Resource; reason: Reason | undefined }): void | PromiseLike<void>
  abort(context: { resource: Resource | undefined; reason: Reason | undefined }): void | PromiseLike<void>
  actions?: { [name: string]: (context: { resource: Resource; signal: AbortSignal }, ...args: any[]) => unknown }
  onCleanupError?(error: unknown, context: { command: "abort" | "dispose" | "closeFailed"; reason: Reason | undefined }): void
}): ResourceType

function useResource(type: ResourceType, input: Input): readonly [snapshot: ResourceSnapshot, controller: ResourceController]
```

## 인자

`createResource`는 모듈 최상위에서 부릅니다.

| 항목 | 하는 일 |
| --- | --- |
| `open` | 자원을 엽니다. 자원이 바깥 사정으로 끊기면 `terminated(reason)`을 부릅니다. `signal`은 여는 도중 취소되면 켜집니다. |
| `close` | 정상적으로 닫습니다. |
| `abort` | 강제로 끊습니다. 아직 열리는 중이면 `resource`가 `undefined`입니다. |
| `actions` | 열린 자원으로 할 동작. controller에 같은 이름으로 붙습니다. `signal`은 자원이 무효가 되면(`abort`, 종료, `terminated`) 켜집니다. |
| `onCleanupError` | `abort`나 정리가 실패한 오류를 받습니다. |

`useResource`의 `input`은 다음 `open()`에 넘길 값입니다. input이 바뀌어도 다시 열지 않습니다.

## 반환값

- `snapshot`: `phase`가 `"closed"`, `"opening"`, `"open"`, `"closing"` 중 하나. `"closed"`이면 `closedBy`(`"initial"`, `"close"`, `"openFailed"`, `"closeFailed"`, `"abort"`, `"lost"`)와 `reason`이 함께 있습니다.
- `controller`:

| 멤버 | 하는 일 |
| --- | --- |
| `open()` / `close(reason?)` / `abort(reason?)` | 요청 객체를 바로 반환합니다. 결과는 `request.getResult()`로 읽습니다(`pending`, `succeeded`, `failed`, `superseded`). |
| `<action>(...args)` | `actions`에 정의한 동작. 자원이 열려 있지 않으면 오류입니다. |
| `opened`, `closed`, `lost` 등 | 상태 변화를 `subscribe(listener)`로 받습니다: `openRequested`, `openStarted`, `opened`, `openFailed`, `closeRequested`, `closeStarted`, `closed`, `closeFailed`, `abortRequested`, `aborted`, `lost`. |

## 동작

- 모든 작업은 요청하고 결과를 나중에 받습니다. `open` 등이 동기로 실패해도 throw하지 않고, 상태와 요청 결과로 알립니다.
- 상태가 바뀌면 Model이 다시 평가됩니다.
- 정상 `close()`는 진행 중인 action이 끝난 뒤 닫습니다. `abort`나 종료로 무효가 된 action의 Promise는 끝날 때 `ResourceActionSupersededError`로 reject되므로, action은 `signal`이 켜지면 끝내야 합니다.
- Model이 종료되면 자원을 `abort`합니다.
- `open`·`close`·`abort`는 [`useEffect`](./useEffect.md)나 callback 안에서 부릅니다.

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
// 연결된 뒤 chat.send("hello")로 보냅니다. 연결 전에 부르면 오류입니다
```
