import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import { Chat } from "./chat";
import { FakeWebSocket } from "./fake-web-socket";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const input = { url: "wss://chat.example/room", name: "김" };

beforeEach(() => {
  FakeWebSocket.instances.length = 0;
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chat", () => {
  it("connects when created and becomes connected when the server accepts", async () => {
    const chat = Behavon.createModel(Chat, input);
    const view = Behavon.getSnapshot(chat.view);
    expect(FakeWebSocket.latest().url).toBe(input.url);
    await settle();
    expect(view()).toMatchObject({ status: "connecting", canSend: false });
    FakeWebSocket.latest().accept();
    await settle();
    expect(view()).toMatchObject({ status: "connected", canSend: true });
    chat.dispose();
  });

  it("receives messages only while connected", async () => {
    const chat = Behavon.createModel(Chat, input);
    const socket = FakeWebSocket.latest();
    socket.accept();
    await settle();
    socket.push(JSON.stringify({ from: "이", text: "안녕" }));
    socket.push("plain text");
    await settle();
    expect(Behavon.getSnapshot(chat.view)()?.messages).toEqual([
      { from: "이", text: "안녕" },
      { from: "?", text: "plain text" },
    ]);
    chat.dispose();
  });

  it("sends with the user's name and ignores empty text", async () => {
    const chat = Behavon.createModel(Chat, input);
    const socket = FakeWebSocket.latest();
    chat.send("연결 전 메시지");
    expect(socket.sent).toEqual([]);
    socket.accept();
    await settle();
    chat.send("   ");
    chat.send("반가워요");
    expect(socket.sent).toEqual([JSON.stringify({ from: "김", text: "반가워요" })]);
    chat.dispose();
  });

  it("disconnects on request and connects again", async () => {
    const chat = Behavon.createModel(Chat, input);
    const view = Behavon.getSnapshot(chat.view);
    FakeWebSocket.latest().accept();
    await settle();
    chat.disconnect();
    await settle();
    expect(FakeWebSocket.latest().closedWith).toEqual({ code: 1000, reason: "나감" });
    expect(view()).toMatchObject({ status: "disconnected", closedBy: "close", reason: "나감" });

    chat.connect();
    await settle();
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.latest().accept();
    await settle();
    expect(view()?.status).toBe("connected");
    chat.dispose();
  });

  it("shows why the connection was lost", async () => {
    const chat = Behavon.createModel(Chat, input);
    FakeWebSocket.latest().accept();
    await settle();
    FakeWebSocket.latest().drop(1006);
    await settle();
    expect(Behavon.getSnapshot(chat.view)()).toMatchObject({
      status: "disconnected",
      closedBy: "lost",
      reason: "서버와 연결이 끊겼습니다 (1006)",
      canSend: false,
    });
    chat.dispose();
  });

  it("shows the failure when the connection cannot open", async () => {
    const chat = Behavon.createModel(Chat, input);
    FakeWebSocket.latest().drop(1006);
    await settle();
    expect(Behavon.getSnapshot(chat.view)()).toMatchObject({ status: "disconnected", closedBy: "openFailed" });
    chat.dispose();
  });

  it("closes the socket when disposed, even while connecting", async () => {
    const chat = Behavon.createModel(Chat, input);
    const socket = FakeWebSocket.latest();
    chat.dispose();
    await settle();
    expect(socket.closedWith?.code).toBe(4000);
  });
});
