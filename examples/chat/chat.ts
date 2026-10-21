import Behavon, { type Model, type ResourceClosedBy, type Signal, type SnapshotRootId } from "behavon";
import { ChatSocket } from "./chat-socket";

export interface ChatMessage {
  readonly from: string;
  readonly text: string;
}

export type ChatStatus = "connecting" | "connected" | "closing" | "disconnected";

export interface ChatView {
  readonly status: ChatStatus;
  /** Why the chat is disconnected. */
  readonly closedBy: ResourceClosedBy | undefined;
  readonly reason: string | undefined;
  readonly messages: readonly ChatMessage[];
  readonly canSend: boolean;
}

export interface ChatPort {
  view: SnapshotRootId<ChatView>;
  connect: Signal;
  disconnect: Signal;
  send: Signal<[text: string]>;
}

const chatPort = Behavon.createPort<ChatPort>({
  view: Behavon.SnapshotType(),
  connect: Behavon.SignalType(),
  disconnect: Behavon.SignalType(),
  send: Behavon.SignalType(),
});

export interface ChatInput {
  readonly url: string;
  /** The name sent with each message. */
  readonly name: string;
}

const statusOf = { opening: "connecting", open: "connected", closing: "closing", closed: "disconnected" } as const;

function parse(data: string): ChatMessage {
  try {
    const value = JSON.parse(data) as Partial<ChatMessage>;
    return { from: String(value.from ?? "?"), text: String(value.text ?? "") };
  } catch {
    return { from: "?", text: data };
  }
}

/** Connects when created, receives messages while connected, and disconnects when disposed. */
export const Chat: Model<ChatInput, ChatStatus, ChatPort> = (input) => {
  const { url, name } = input;
  const viewId = Behavon.useExport(chatPort, "view");
  const socketInput = Behavon.useMemo(() => ({ url }), [url]);
  const [connection, socket] = Behavon.useResource(ChatSocket, socketInput);
  const [messages, setMessages] = Behavon.useState<readonly ChatMessage[]>([]);
  const status = statusOf[connection.phase];

  Behavon.useEffect(() => {
    socket.open();
    return () => {
      socket.abort("left");
    };
  }, [socket]);

  Behavon.useEffect(() => {
    if (status !== "connected") return undefined;
    return socket.listen((data) => setMessages((current) => [...current, parse(data)]));
  }, [setMessages, socket, status]);

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({
      status,
      closedBy: connection.phase === "closed" ? connection.closedBy : undefined,
      reason: connection.phase === "closed" ? connection.reason : undefined,
      messages,
      canSend: status === "connected",
    });
  }, [connection, messages, publish, status]);

  const connect = Behavon.useCallback(() => {
    socket.open();
  }, [socket]);
  Behavon.useSignal(chatPort, "connect", connect);
  Behavon.useExport(chatPort, "connect");

  const disconnect = Behavon.useCallback(() => {
    socket.close("나감");
  }, [socket]);
  Behavon.useSignal(chatPort, "disconnect", disconnect);
  Behavon.useExport(chatPort, "disconnect");

  const send = Behavon.useCallback((text: string) => {
    if (status !== "connected" || text.trim() === "") return;
    socket.send(JSON.stringify({ from: name, text }));
  }, [name, socket, status]);
  Behavon.useSignal(chatPort, "send", send);
  Behavon.useExport(chatPort, "send");

  return status;
};
