import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { Counter } from "./counter";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("counter", () => {
  it("publishes the starting view", () => {
    const counter = Behavon.createModel(Counter, 3);
    expect(Behavon.getSnapshot(counter.view)()).toEqual({ count: 3, isZero: false });
    counter.dispose();
  });

  it("applies each command", async () => {
    const counter = Behavon.createModel(Counter, 0);
    const read = Behavon.getSnapshot(counter.view);
    counter.increment();
    counter.increment();
    await settle();
    expect(read()).toEqual({ count: 2, isZero: false });
    counter.decrement();
    await settle();
    expect(read()?.count).toBe(1);
    counter.add(5);
    await settle();
    expect(read()?.count).toBe(6);
    counter.reset();
    await settle();
    expect(read()).toEqual({ count: 0, isZero: true });
    counter.dispose();
  });

  it("resets to the starting value it was created with", async () => {
    const counter = Behavon.createModel(Counter, 10);
    counter.add(5);
    await settle();
    counter.reset();
    await settle();
    expect(Behavon.getSnapshot(counter.view)()?.count).toBe(10);
    counter.dispose();
  });
});
