# Chat

Joins a chat room over a WebSocket and exchanges messages. When the connection drops, it shows the reason and lets you reconnect.

## What it shows

- Defining the WebSocket with [`createResource`](../../../docs/en/api/useResource.md)
  - `open`: a Promise that ends when the connection opens. If cancelled while connecting, it closes the socket.
  - When the server drops the connection after it opened, `terminated(reason)` → the snapshot's `closedBy` becomes `"lost"`
  - `close` waits for the socket to close, and `abort` closes it right away.
  - The actions `send` and `listen`. `listen` attaches a message listener and returns a function that removes it.
- Showing the connection state from the snapshot of [`useResource`](../../../docs/en/api/useResource.md)
- Calling `listen` in [`useEffect`](../../../docs/en/api/useEffect.md) only while connected, and removing it in the cleanup function
- When the Model is terminated, the socket is closed, even while connecting.

## Files

| File | Role |
| --- | --- |
| [chat-socket.ts](./chat-socket.ts) | The `ChatSocket` Resource. |
| [chat.ts](./chat.ts) | The `Chat` Model. Its input is the address to join and the name attached to sent messages. |
| [chat-view.tsx](./chat-view.tsx) | Connection state, message list, input, and the leave and reconnect buttons. |
| [fake-web-socket.ts](./fake-web-socket.ts) | A WebSocket stand-in whose server side (accept, message, drop) the tests trigger. |
| [chat.test.ts](./chat.test.ts) | Checks connecting, receiving, sending, leaving and reconnecting, dropping, failing to connect, and termination. |
| [chat-view.test.tsx](./chat-view.test.tsx) | Checks connecting, receiving, sending, and the dropped state on screen. |

## Usage

```tsx
const chat = Behavon.createModel(Chat, { url: "wss://chat.example/room", name: "Kim" })
root.render(<ChatView chat={chat} />)
// after unmounting the screen
chat.dispose()
```
