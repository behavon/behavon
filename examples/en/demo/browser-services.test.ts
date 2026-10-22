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
    const found = searchApi.search("app", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(300);
    await expect(found).resolves.toEqual(["apple"]);

    const controller = new AbortController();
    const slow = searchApi.search("slow", controller.signal);
    controller.abort(new Error("newer search"));
    await expect(slow).rejects.toThrow("newer search");
  });

  it("fails an upload whose name contains fail", async () => {
    const failed = uploadApi.upload("fail.png", new AbortController().signal);
    const done = uploadApi.upload("photo.png", new AbortController().signal);
    const checked = expect(failed).rejects.toThrow("The server refused it");
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
    expect((await query).map((row) => row.customer)).toEqual(["Choi", "Lee"]);

    const controller = new AbortController();
    const cancelled = connection.query("", [0], controller.signal);
    controller.abort(new Error("cancelled"));
    await expect(cancelled).rejects.toThrow("cancelled");
  });

  it("prices an item, or declines one it does not carry", async () => {
    const source = priceSource(100, 120, "screw");
    const priced = source("bolt", 10);
    const declined = source("screw", 10);
    await vi.advanceTimersByTimeAsync(100);
    await expect(priced).resolves.toBe(110);
    await expect(declined).resolves.toBeUndefined();
  });
});
