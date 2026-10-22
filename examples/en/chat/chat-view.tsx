import { useState, useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { ChatPort, ChatStatus } from "./chat";

const statusText: Record<ChatStatus, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  closing: "Closing…",
  disconnected: "Disconnected",
};

export function ChatView({ chat }: { readonly chat: TypedModelRef<ChatPort> }) {
  const view = useSyncExternalStore(Behavon.subscribe(chat.view), Behavon.getSnapshot(chat.view));
  const [text, setText] = useState("");
  if (view === undefined) return null;
  return (
    <section>
      <p role="status">{statusText[view.status]}{view.reason === undefined ? "" : `: ${view.reason}`}</p>
      {view.status === "disconnected"
        ? <button type="button" onClick={() => chat.connect()}>Reconnect</button>
        : <button type="button" disabled={view.status !== "connected"} onClick={() => chat.disconnect()}>Leave</button>}
      <ul aria-label="Messages">
        {view.messages.map((message, index) => <li key={index}>{message.from}: {message.text}</li>)}
      </ul>
      <form onSubmit={(event) => { event.preventDefault(); chat.send(text); setText(""); }}>
        <input aria-label="New message" value={text} onChange={(event) => setText(event.target.value)} />
        <button type="submit" disabled={!view.canSend}>Send</button>
      </form>
    </section>
  );
}
