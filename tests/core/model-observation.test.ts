import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { ModelInstance, StateSetter } from "behavon";
import {
  inspectModelInstanceForTests,
  inspectRetainedOperationForTests,
} from "../../src/internal/model-inspection";
import { waitFor } from "../helpers";

async function captureScheduledFailure(action: () => void): Promise<unknown> {
  let surfaced: unknown;
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
    try {
      if (typeof handler === "function") handler();
    } catch (error: unknown) {
      surfaced = error;
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  try {
    action();
    await waitFor(() => surfaced !== undefined || true);
    await Promise.resolve();
    await Promise.resolve();
    return surfaced;
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
}

describe("independently owned Model observation", () => {
  it("returns the committed output and a stable instance-owned input setter", async () => {
    const evaluations: number[] = [];
    function Target(input: number): string {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations.push(input);
      return `value:${input}`;
    }
    const target = Behavon.createModel(Target, 1);
    const setters: StateSetter<number>[] = [];
    let latestOutput: string | undefined;
    let consumerEvaluations = 0;
    function Consumer(): undefined {
      const [output, setInput] = Behavon.useModel(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      if (setters.length === 0) setters.push(setInput);
      expect(setInput).toBe(setters[0]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      latestOutput = output;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      consumerEvaluations += 1;
      return undefined;
    }
    const consumer = Behavon.createModel(Consumer, undefined);
    expect(latestOutput).toBe("value:1");
    const firstSetter = setters[0];
    if (firstSetter === undefined) throw new Error("Consumer did not receive the target input setter");

    firstSetter((previous) => previous + 1);
    await waitFor(() => latestOutput === "value:2");
    expect(evaluations).toEqual([1, 2]);
    expect(consumerEvaluations).toBe(2);

    consumer.dispose();
    expect(inspectModelInstanceForTests(target).status).toBe("active");
    target.dispose();
  });

  it("updates a nullable target through null without changing its lifetime", async () => {
    const evaluations: Array<string | null> = [];
    function Target(input: string | null): string {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations.push(input);
      return input ?? "null";
    }
    const target = Behavon.createModel(Target, null);
    let latestOutput: string | undefined;
    let setInput: StateSetter<string | null> | undefined;
    function Consumer(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [latestOutput, setInput] = Behavon.useModel(target);
      return undefined;
    }
    const consumer = Behavon.createModel(Consumer, undefined);
    expect(latestOutput).toBe("null");
    if (setInput === undefined) throw new Error("Consumer did not receive the target input setter");

    setInput("value");
    await waitFor(() => latestOutput === "value");
    setInput(null);
    await waitFor(() => evaluations.length === 3);

    expect(evaluations).toEqual([null, "value", null]);
    expect(latestOutput).toBe("null");
    expect(inspectModelInstanceForTests(target).status).toBe("active");
    consumer.dispose();
    expect(inspectModelInstanceForTests(target).status).toBe("active");
    target.dispose();
  });

  it("bails out final Object.is-equal input and only invalidates consumers for changed output", async () => {
    let targetEvaluations = 0;
    function Target(input: number): number {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      targetEvaluations += 1;
      return input % 2;
    }
    const target = Behavon.createModel(Target, 1);
    let setTargetInput: StateSetter<number> | undefined;
    let consumerEvaluations = 0;
    function Consumer(): undefined {
      const [, setInput] = Behavon.useModel(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setTargetInput = setInput;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      consumerEvaluations += 1;
      return undefined;
    }
    const consumer = Behavon.createModel(Consumer, undefined);

    setTargetInput?.(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(targetEvaluations).toBe(2);
    expect(consumerEvaluations).toBe(1);

    setTargetInput?.(3);
    await waitFor(() => targetEvaluations === 3);
    expect(consumerEvaluations).toBe(1);

    setTargetInput?.(4);
    await waitFor(() => consumerEvaluations === 2);
    consumer.dispose();
    target.dispose();
  });

  it("tracks multiple consumers and releases each reverse observation lease", async () => {
    const target = Behavon.createModel((input: number) => input, 0);
    const counts = [0, 0];
    const setters: StateSetter<number>[] = [];
    function createConsumer(index: number): ModelInstance<undefined, undefined> {
      function Consumer(): undefined {
        const [, setInput] = Behavon.useModel(target);
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        setters[index] = setInput;
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        counts[index] += 1;
        return undefined;
      }
      return Behavon.createModel(Consumer, undefined);
    }
    const first = createConsumer(0);
    const second = createConsumer(1);
    expect(inspectModelInstanceForTests(target).observers.size).toBe(2);
    first.dispose();
    expect(inspectModelInstanceForTests(target).observers.size).toBe(1);
    setters[1]?.(1);
    await waitFor(() => counts[1] === 2);
    expect(counts[0]).toBe(1);
    second.dispose();
    expect(inspectModelInstanceForTests(target).observers.size).toBe(0);
    target.dispose();
  });

  it("switches targets on commit and leaves the previous observation intact on candidate failure", async () => {
    const first = Behavon.createModel((input: number) => `first:${input}`, 0);
    const second = Behavon.createModel((input: number) => `second:${input}`, 0);
    let observed: ModelInstance<number, string> = first;
    let shouldFail = false;
    let setSelection: StateSetter<number> | undefined;
    function Consumer(input: number): string {
      const [selection, setInput] = Behavon.useState(input);
      const [output] = Behavon.useModel(selection === 0 ? first : second);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setSelection = setInput;
      if (shouldFail) throw new Error("candidate failed");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      observed = selection === 0 ? first : second;
      return output;
    }
    const consumer = Behavon.createModel(Consumer, 0);
    expect(inspectModelInstanceForTests(first).observers.size).toBe(1);
    setSelection?.(1);
    await waitFor(() => observed === second);
    expect(inspectModelInstanceForTests(first).observers.size).toBe(0);
    expect(inspectModelInstanceForTests(second).observers.size).toBe(1);

    // A terminal uncaught consumer failure cannot keep a usable committed graph,
    // but it also must not attach its uncommitted candidate edge.
    shouldFail = true;
    const failure = await captureScheduledFailure(() => setSelection?.(0));
    expect(String(failure)).toContain("candidate failed");
    expect(inspectModelInstanceForTests(first).observers.size).toBe(0);
    expect(inspectModelInstanceForTests(second).observers.size).toBe(0);
    first.dispose();
    second.dispose();
    void consumer;
  });

  it("invalidates live consumers when the target terminates and tombstones its retained setter", async () => {
    const target = Behavon.createModel((input: number) => input, 0);
    let setter: StateSetter<number> | undefined;
    function Consumer(): undefined {
      const [, setInput] = Behavon.useModel(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setter = setInput;
      return undefined;
    }
    const consumer = Behavon.createModel(Consumer, undefined);
    const retained = setter as StateSetter<number>;
    target.dispose();
    const failure = await captureScheduledFailure(() => undefined);
    expect(String(failure)).toMatch(/disposed during model observation/);
    expect(inspectModelInstanceForTests(consumer).status).toBe("disposed");
    expect(() => retained(1)).toThrow(/requires a live Model instance/);
    const operation = inspectRetainedOperationForTests(retained);
    expect(operation.kind).toBe("modelInputSetter");
    expect(operation.instance).toBeUndefined();
  });

  it("rejects updater failure, self observation, cycles, and ownerless creation during evaluation", async () => {
    const target = Behavon.createModel((input: number) => input, 0);
    let setter: StateSetter<number> | undefined;
    function Consumer(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, setter] = Behavon.useModel(target);
      return undefined;
    }
    const consumer = Behavon.createModel(Consumer, undefined);
    const originalFailure = new Error("updater failed");
    const updaterFailure = await captureScheduledFailure(() => setter?.(() => {
      throw originalFailure;
    }));
    expect(updaterFailure).toBe(originalFailure);
    expect(inspectModelInstanceForTests(target).status).toBe("disposed");
    expect(inspectModelInstanceForTests(consumer).status).toBe("disposed");

    expect(() => Behavon.createModel(() => {
      Behavon.createModel(() => undefined, undefined);
      return undefined;
    }, undefined)).toThrow(/cannot create an ownerless Model while evaluating/);

    const base = Behavon.createModel((input: number) => input, 0);
    function Observer(input: ModelInstance<any, any>): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- self/cycle probe needs the observation edge, not the returned handle
      Behavon.useModel(input);
      return undefined;
    }
    const self = Behavon.createModel(Observer, base);
    let setSelfInput: StateSetter<ModelInstance<any, any>> | undefined;
    function Controller(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, setSelfInput] = Behavon.useModel(self);
      return undefined;
    }
    const controller = Behavon.createModel(Controller, undefined);
    const selfFailure = await captureScheduledFailure(() => setSelfInput?.(self));
    expect(String(selfFailure)).toMatch(/cannot observe its own Model/);
    expect(inspectModelInstanceForTests(self).status).toBe("disposed");
    expect(inspectModelInstanceForTests(controller).status).toBe("disposed");

    const first = Behavon.createModel(Observer, base);
    const second = Behavon.createModel(Observer, first);
    let setFirstInput: StateSetter<ModelInstance<any, any>> | undefined;
    function CycleController(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, setFirstInput] = Behavon.useModel(first);
      return undefined;
    }
    const cycleController = Behavon.createModel(CycleController, undefined);
    const cycleFailure = await captureScheduledFailure(() => setFirstInput?.(second));
    expect(String(cycleFailure)).toMatch(/observation cycle detected/);
    expect(inspectModelInstanceForTests(first).status).toBe("disposed");
    expect(inspectModelInstanceForTests(second).status).toBe("disposed");
    expect(inspectModelInstanceForTests(cycleController).status).toBe("disposed");
    base.dispose();
  });
});
