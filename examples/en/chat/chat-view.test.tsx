// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import { Chat } from "./chat";
import { ChatView } from "./chat-view";
import { FakeWebSocket } from "./fake-web-socket";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatView", () => {
  it("shows the connection, receives, and sends messages", async () => {
    FakeWebSocket.instances.length = 0;
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const chat = Behavon.createModel(Chat, { url: "wss://chat.example/room", name: "Kim" });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ChatView chat={chat} />));

    const run = async (action: () => void) => {
      await act(async () => {
        action();
        await settle();
      });
    };
    const status = () => container.querySelector("[role='status']")?.textContent;
    const socket = FakeWebSocket.latest();

    expect(status()).toBe("Connecting…");
    await run(() => socket.accept());
    expect(status()).toBe("Connected");
    await run(() => socket.push(JSON.stringify({ from: "Lee", text: "Hello" })));
    expect(container.querySelector("[aria-label='Messages'] li")?.textContent).toBe("Lee: Hello");

    const field = container.querySelector("input") as HTMLInputElement;
    await run(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, "Nice to meet you");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await run(() => (container.querySelector("button[type='submit']") as HTMLButtonElement).click());
    expect(socket.sent).toEqual([JSON.stringify({ from: "Kim", text: "Nice to meet you" })]);

    await run(() => socket.drop(1006));
    expect(status()).toBe("Disconnected: Lost the connection to the server (1006)");
    expect(container.querySelector("button")?.textContent).toBe("Reconnect");

    await act(async () => root.unmount());
    container.remove();
    chat.dispose();
  });
});
