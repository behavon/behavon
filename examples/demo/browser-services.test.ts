import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseDriver, priceSource, searchApi, uploadApi } from "./browser-services";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("browser services", () => {
  it("searches after a delay and stops when the signal aborts", async () => {
    const found = searchApi.search("사", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(300);
    await expect(found).resolves.toEqual(["사과"]);

    const controller = new AbortController();
    const slow = searchApi.search("느림", controller.signal);
    controller.abort(new Error("newer search"));
    await expect(slow).rejects.toThrow("newer search");
  });

  it("fails an upload whose name contains 실패", async () => {
    const failed = uploadApi.upload("실패.png", new AbortController().signal);
    const done = uploadApi.upload("사진.png", new AbortController().signal);
    const checked = expect(failed).rejects.toThrow("서버가 거부했습니다");
    await vi.advanceTimersByTimeAsync(1_000);
    await checked;
    await expect(done).resolves.toBeUndefined();
  });

  it("connects, queries by minimum total, and cancels a query", async () => {
    const connecting = databaseDriver.connect("demo://shop", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(500);
    const connection = await connecting;

    const query = connection.query("", [40_000], new AbortController().signal);
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await query).map((row) => row.customer)).toEqual(["최", "이"]);

    const controller = new AbortController();
    const cancelled = connection.query("", [0], controller.signal);
    controller.abort(new Error("cancelled"));
    await expect(cancelled).rejects.toThrow("cancelled");
  });

  it("prices an item, or declines one it does not carry", async () => {
    const source = priceSource(100, 120, "나사");
    const priced = source("볼트", 10);
    const declined = source("나사", 10);
    await vi.advanceTimersByTimeAsync(100);
    await expect(priced).resolves.toBe(110);
    await expect(declined).resolves.toBeUndefined();
  });
});
