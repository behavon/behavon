import Behavon, { type ResourceAbortSignal } from "behavon";

export interface ChatSocketInput {
  readonly url: string;
}

/** A WebSocket as a Resource. The reason is a short text shown to the user. */
export const ChatSocket = Behavon.createResource({
  open: ({ input, signal, terminated }: {
    input: ChatSocketInput;
    signal: ResourceAbortSignal;
    terminated(reason: string): void;
  }) =>
    new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(input.url);
      let opened = false;
      socket.addEventListener("open", () => {
        opened = true;
        resolve(socket);
      }, { once: true });
      socket.addEventListener("error", () => {
        if (!opened) reject(new Error("연결하지 못했습니다"));
      }, { once: true });
      socket.addEventListener("close", (event) => {
        if (!opened) reject(new Error(`연결 중에 닫혔습니다 (${event.code})`));
        else terminated(`서버와 연결이 끊겼습니다 (${event.code})`);
      }, { once: true });
      signal.addEventListener("abort", () => {
        if (!opened) socket.close(4000, "aborted");
      }, { once: true });
    }),
  close: ({ resource, reason }: { resource: WebSocket; reason: string | undefined }) =>
    new Promise<void>((resolve) => {
      if (resource.readyState === resource.CLOSED) {
        resolve();
        return;
      }
      resource.addEventListener("close", () => resolve(), { once: true });
      resource.close(1000, reason ?? "closed");
    }),
  abort: ({ resource, reason }: { resource: WebSocket | undefined; reason: string | undefined }) => {
    resource?.close(4000, reason ?? "aborted");
  },
  actions: {
    send: ({ resource }: { resource: WebSocket }, data: string) => resource.send(data),
    /** Calls `listener` for each message until the returned function is called. */
    listen: ({ resource }: { resource: WebSocket }, listener: (data: string) => void) => {
      const handle = (event: MessageEvent) => listener(String(event.data));
      resource.addEventListener("message", handle);
      return () => resource.removeEventListener("message", handle);
    },
  },
});
