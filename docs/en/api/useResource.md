# `createResource(definition)` / `useResource(type, input)`

Lets a Model own an external resource that is opened and closed, such as a WebSocket or a stream.

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

## Parameters

Call `createResource` at module top level.

| Member | What it does |
| --- | --- |
| `open` | Opens the resource. When the resource is cut off from outside, it calls `terminated(reason)`. `signal` turns on when opening is cancelled. |
| `close` | Closes normally. |
| `abort` | Cuts off forcibly. While still opening, `resource` is `undefined`. |
| `actions` | Actions on the open resource, attached to the controller under the same names. `signal` turns on when the resource becomes invalid (`abort`, termination, `terminated`). |
| `onCleanupError` | Receives the error when `abort` or cleanup fails. |

The `input` of `useResource` is the value passed to the next `open()`. Changing the input does not reopen.

## Returns

- `snapshot`: its `phase` is `"closed"`, `"opening"`, `"open"`, or `"closing"`. When `"closed"`, it also has `closedBy` (`"initial"`, `"close"`, `"openFailed"`, `"closeFailed"`, `"abort"`, `"lost"`) and `reason`.
- `controller`:

| Member | What it does |
| --- | --- |
| `open()` / `close(reason?)` / `abort(reason?)` | Returns a request object immediately. Read the result with `request.getResult()` (`pending`, `succeeded`, `failed`, `superseded`). |
| `<action>(...args)` | An action defined in `actions`. An error if the resource is not open. |
| `opened`, `closed`, `lost`, and so on | `subscribe(listener)` receives state changes: `openRequested`, `openStarted`, `opened`, `openFailed`, `closeRequested`, `closeStarted`, `closed`, `closeFailed`, `abortRequested`, `aborted`, `lost`. |

## Behavior

- Every operation is requested and its result arrives later. Even if `open` and the like fail synchronously, nothing is thrown; the failure is reported through the state and the request result.
- When the state changes, the Model is evaluated again.
- A normal `close()` closes after the actions in progress finish. The Promise of an action invalidated by `abort` or termination rejects with `ResourceActionSupersededError` when it ends, so an action should finish once its `signal` turns on.
- When the Model is terminated, the resource is `abort`ed.
- Call `open`, `close`, and `abort` inside [`useEffect`](./useEffect.md) or a callback.

## Example

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
// result: "opening" at first, "open" once connected
// once connected, send with chat.send("hello"). Calling it before that is an error
```
