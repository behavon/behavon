/** A WebSocket stand-in whose server side the test drives: accept, push a message, or drop the connection. */
export class FakeWebSocket extends EventTarget {
  static readonly instances: FakeWebSocket[] = [];

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  readonly sent: string[] = [];
  closedWith: { code: number; reason: string } | undefined;

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  static latest(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1);
    if (socket === undefined) throw new Error("no socket was created");
    return socket;
  }

  send(data: string): void {
    if (this.readyState !== this.OPEN) throw new Error("InvalidStateError");
    this.sent.push(data);
  }

  close(code = 1000, reason = ""): void {
    if (this.readyState >= this.CLOSING) return;
    this.readyState = this.CLOSING;
    this.closedWith = { code, reason };
    queueMicrotask(() => this.finishClose(code, reason, true));
  }

  /** Server side: the connection is accepted. */
  accept(): void {
    this.readyState = this.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  /** Server side: a message arrives. */
  push(data: string): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  /** Server side: the server closes the connection. */
  drop(code: number): void {
    this.finishClose(code, "server closed", false);
  }

  private finishClose(code: number, reason: string, wasClean: boolean): void {
    if (this.readyState === this.CLOSED) return;
    this.readyState = this.CLOSED;
    const event = new Event("close");
    Object.defineProperties(event, {
      code: { value: code },
      reason: { value: reason },
      wasClean: { value: wasClean },
    });
    this.dispatchEvent(event);
  }
}
