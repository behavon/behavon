import { useState, useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { ChatPort, ChatStatus } from "./chat";

const statusText: Record<ChatStatus, string> = {
  connecting: "연결 중…",
  connected: "연결됨",
  closing: "연결을 닫는 중…",
  disconnected: "연결 끊김",
};

export function ChatView({ chat }: { readonly chat: TypedModelRef<ChatPort> }) {
  const view = useSyncExternalStore(Behavon.subscribe(chat.view), Behavon.getSnapshot(chat.view));
  const [text, setText] = useState("");
  if (view === undefined) return null;
  return (
    <section>
      <p role="status">{statusText[view.status]}{view.reason === undefined ? "" : `: ${view.reason}`}</p>
      {view.status === "disconnected"
        ? <button type="button" onClick={() => chat.connect()}>다시 연결</button>
        : <button type="button" disabled={view.status !== "connected"} onClick={() => chat.disconnect()}>나가기</button>}
      <ul aria-label="메시지">
        {view.messages.map((message, index) => <li key={index}>{message.from}: {message.text}</li>)}
      </ul>
      <form onSubmit={(event) => { event.preventDefault(); chat.send(text); setText(""); }}>
        <input aria-label="메시지 입력" value={text} onChange={(event) => setText(event.target.value)} />
        <button type="submit" disabled={!view.canSend}>보내기</button>
      </form>
    </section>
  );
}
