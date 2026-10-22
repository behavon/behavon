// Runs the examples in docs/ exactly as written (extracted by scripts/extract-doc-examples.mjs)
// and checks the results each page states.
import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import { outputOf, settle } from "./support";

describe("documentation example coverage", () => {
  it("checks every extracted example in a docs test", () => {
    const directory = new URL("./", import.meta.url);
    const tests = ["examples.test.ts", "examples.dom.test.tsx"]
      .map((name) => readFileSync(new URL(name, directory), "utf8"))
      .join("\n");
    const examples = readdirSync(new URL("./.generated/", directory)).map((name) => name.replace(/\.tsx?$/, ""));
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.filter((name) => !tests.includes(`./.generated/${name}"`))).toEqual([]);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("docs/getting-started.md", () => {
  it("calls the exported increment Signal", async () => {
    const { counter } = await import("./.generated/getting-started-1");
    expect(outputOf(counter)).toBe(1);
    counter.increment();
    await settle();
    expect(outputOf(counter)).toBe(2);
    counter.dispose();
  });
});

describe("docs/core-concepts.md", () => {
  it("creates, disposes, and calls an exported Signal", async () => {
    const { counter, publicCounter } = await import("./.generated/core-concepts-1");
    expect(() => counter.dispose()).toThrow(/dispose\(\) called more than once/);
    await settle();
    expect(outputOf(publicCounter)).toBe(1);
    publicCounter.dispose();
  });
});

describe("docs/api/createModel.md", () => {
  it("returns an instance that is already disposed at the end of the example", async () => {
    const { Counter, counter } = await import("./.generated/api-createModel-1");
    expect(() => counter.dispose()).toThrow(/dispose\(\) called more than once/);
    const fresh = Behavon.createModel(Counter, 10);
    expect(outputOf(fresh)).toBe(10);
    fresh.increment();
    await settle();
    expect(outputOf(fresh)).toBe(11);
    fresh.dispose();
  });
});

describe("docs/api/createPort.md", () => {
  it("reads the exported snapshot after the exported Signal runs", async () => {
    const { counter, read } = await import("./.generated/api-createPort-1");
    await settle();
    expect(read()).toBe(1);
    counter.dispose();
  });
});

describe("docs/api/createId.md", () => {
  it("creates frozen identities of every documented form", async () => {
    const { transactionId, count, app, states } = await import("./.generated/api-createId-1");
    for (const id of [transactionId, count, app, app.user, app.settings.theme, states.balance]) {
      expect(typeof id).toBe("object");
    }
    expect(Object.isFrozen(app)).toBe(true);
    expect(Object.isFrozen(app.settings)).toBe(true);
  });
});

describe("docs/api/getInterface.md", () => {
  it("lists the registered Signal", async () => {
    const { counter } = await import("./.generated/api-getInterface-1");
    expect(Behavon.getInterface(counter)).toEqual({
      endpoints: [{ name: "increment", signalRegistrations: 1, slotRegistrations: 0 }],
    });
    counter.dispose();
  });
});

describe("docs/api/useModel.md", () => {
  it("updates the target input from the observing Model", async () => {
    const { counter, doubled } = await import("./.generated/api-useModel-1");
    await settle();
    expect(outputOf(counter)).toBe(1);
    expect(outputOf(doubled)).toBe(2);
    doubled.dispose();
    counter.dispose();
  });
});

describe("docs/api/useState.md", () => {
  it("shows the initial result and the result after the Effect setters", async () => {
    const { Counter, counter } = await import("./.generated/api-useState-1");
    const fresh = Behavon.createModel(Counter, undefined);
    expect(outputOf(fresh)).toBe("count: 3");
    await settle();
    expect(outputOf(fresh)).toBe("count: 5");
    expect(outputOf(counter)).toBe("count: 5");
    fresh.dispose();
    counter.dispose();
  });
});

describe("docs/api/useReducer.md", () => {
  it("shows 20 and then 26", async () => {
    const { Total, totalModel } = await import("./.generated/api-useReducer-1");
    const fresh = Behavon.createModel(Total, undefined);
    expect(outputOf(fresh)).toBe(20);
    await settle();
    expect(outputOf(fresh)).toBe(26);
    expect(outputOf(totalModel)).toBe(26);
    fresh.dispose();
    totalModel.dispose();
  });
});

describe("docs/api/useMutable.md", () => {
  it("shows 0 and then 1", async () => {
    const { Sender, sender } = await import("./.generated/api-useMutable-1");
    const fresh = Behavon.createModel(Sender, undefined);
    expect(outputOf(fresh)).toBe(0);
    await settle();
    expect(outputOf(fresh)).toBe(1);
    expect(outputOf(sender)).toBe(1);
    fresh.dispose();
    sender.dispose();
  });
});

describe("docs/api/useMemo.md", () => {
  it("shows 6", async () => {
    const { report } = await import("./.generated/api-useMemo-1");
    expect(outputOf(report)).toBe(6);
    report.dispose();
  });
});

describe("docs/api/useCallback.md", () => {
  it("shows hello, Kim", async () => {
    const { greeter } = await import("./.generated/api-useCallback-1");
    expect(outputOf(greeter)).toBe("hello, Kim");
    greeter.dispose();
  });
});

describe("docs/api/useEffect.md", () => {
  it("updates every second and clears the interval on dispose", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(1_000_000);
    const clearInterval = vi.spyOn(globalThis, "clearInterval");
    const { clock } = await import("./.generated/api-useEffect-1");
    expect(outputOf(clock)).toBe(0);
    vi.advanceTimersByTime(1000);
    await settle();
    expect(outputOf(clock)).toBe(1_001_000);
    clock.dispose();
    expect(clearInterval).toHaveBeenCalledTimes(1);
  });
});

describe("docs/api/useSignal.md", () => {
  it("reads 2 after the Signal call and one microtask", async () => {
    const { counter, readCount } = await import("./.generated/api-useSignal-1");
    expect(readCount()).toBe(2);
    counter.dispose();
  });
});

describe("docs/api/useSlot.md", () => {
  it("logs the value of a direct Slot call", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { logger } = await import("./.generated/api-useSlot-1");
    expect(log).toHaveBeenCalledWith(1);
    logger.dispose();
  });
});

describe("docs/api/useConnect.md", () => {
  it("logs 0 on creation and 1 after increment", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { counter, logger } = await import("./.generated/api-useConnect-1");
    await settle();
    expect(log.mock.calls.map((call) => call[0])).toEqual([0, 1]);
    counter.dispose();
    logger.dispose();
  });
});

describe("docs/api/useExport.md", () => {
  it("reads the exported snapshot id", async () => {
    const { counter, readCount } = await import("./.generated/api-useExport-1");
    expect(readCount()).toBe(0);
    counter.dispose();
  });
});

describe("docs/api/usePort.md", () => {
  it("increments the target every second", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { counter, autoIncrement } = await import("./.generated/api-usePort-1");
    expect(outputOf(counter)).toBe(0);
    vi.advanceTimersByTime(1000);
    await settle();
    expect(outputOf(counter)).toBe(1);
    vi.advanceTimersByTime(1000);
    await settle();
    expect(outputOf(counter)).toBe(2);
    autoIncrement.dispose();
    counter.dispose();
  });
});

describe("docs/api/useSnapshot.md", () => {
  it("publishes the root and the child value", async () => {
    const { weather, seoul } = await import("./.generated/api-useSnapshot-1");
    expect(Behavon.getSnapshot(weather)()).toEqual({ city: "Seoul" });
    expect(Behavon.getSnapshot(weather.temperature)()).toBe(22);
    seoul.dispose();
  });
});

describe("docs/api/useFuture.md", () => {
  it("shows idle, then pending, then the joined response", async () => {
    const responses: Array<(body: readonly string[]) => void> = [];
    const fetch = vi.fn(() => new Promise((resolve) => {
      responses.push((body) => resolve({ json: async () => body }));
    }));
    vi.stubGlobal("fetch", fetch);
    const { Search, search } = await import("./.generated/api-useFuture-1");
    const fresh = Behavon.createModel(Search, "behavon");
    expect(outputOf(fresh)).toBe("idle");
    await vi.waitFor(() => expect(outputOf(fresh)).toBe("pending"));
    for (const respond of responses) respond(["a", "b"]);
    await vi.waitFor(() => expect(outputOf(fresh)).toBe("a, b"));
    await vi.waitFor(() => expect(outputOf(search)).toBe("a, b"));
    fresh.dispose();
    expect(fetch).toHaveBeenCalledWith("/search?q=behavon", expect.objectContaining({ signal: expect.anything() }));
    search.dispose();
  });
});

describe("docs/api/useResource.md", () => {
  it("opens when the socket connects and sends after that", async () => {
    const sockets: FakeSocket[] = [];
    class FakeSocket extends EventTarget {
      readonly sent: string[] = [];
      constructor(readonly url: string) {
        super();
        sockets.push(this);
      }
      send(message: string): void {
        this.sent.push(message);
      }
      close(): void {}
    }
    vi.stubGlobal("WebSocket", FakeSocket);
    const { chat } = await import("./.generated/api-useResource-1");
    expect(outputOf(chat)).toBe("opening");
    expect(() => chat.send("too early")).toThrow(/requires an open resource/);
    sockets[0].dispatchEvent(new Event("open"));
    await vi.waitFor(() => expect(outputOf(chat)).toBe("open"));
    chat.send("hello");
    expect(sockets[0].url).toBe("wss://example.com/chat");
    expect(sockets[0].sent).toEqual(["hello"]);
    chat.dispose();
  });
});

describe("docs/api/transaction.md", () => {
  it("moves 30 in one transaction", async () => {
    const { accounts } = await import("./.generated/api-transaction-1");
    await settle();
    expect(outputOf(accounts)).toBe("70 / 30");
    accounts.dispose();
  });
});
