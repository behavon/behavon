import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { BoundaryState, ModelInstance, StateSetter } from "behavon";
import { inspectModelInstanceForTests } from "../../src/internal/model-inspection";
import { waitFor } from "../helpers";

function observeBoundary<Input, Output>(instance: ModelInstance<Input, BoundaryState<Output>>) {
  let state: BoundaryState<Output> | undefined;
  let setInput: StateSetter<Input> | undefined;
  let evaluations = 0;
  function Observer(): undefined {
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    evaluations += 1;
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
    [state, setInput] = Behavon.useModel(instance);
    return undefined;
  }
  const observer = Behavon.createModel(Observer, undefined);
  return {
    get state() {
      return state as BoundaryState<Output>;
    },
    get setInput() {
      return setInput as StateSetter<Input>;
    },
    get evaluations() {
      return evaluations;
    },
    dispose() {
      observer.dispose();
    },
  };
}

describe("boundary Model composition", () => {
  it("is pure until createModel and contains a broken initial evaluation in a live outer instance", () => {
    const failure = new Error("initial failure");
    let evaluations = 0;
    function Broken(): never {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluations += 1;
      throw failure;
    }

    const SafeBroken = Behavon.boundary(Broken);
    expect(evaluations).toBe(0);

    const instance = Behavon.createModel(SafeBroken, undefined);
    const observed = observeBoundary(instance);
    expect(evaluations).toBe(1);
    expect(observed.state).toMatchObject({ status: "failed", error: failure });
    expect(inspectModelInstanceForTests(instance).status).toBe("active");
    expect(Behavon.getInterface(instance).endpoints).toEqual([]);

    observed.dispose();
    instance.dispose();
  });

  it("treats null as an ordinary Boundary Child input without remounting", async () => {
    const inputs: Array<string | null> = [];
    let identities = 0;
    function Child(input: string | null): Readonly<{ input: string | null; identity: number }> {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      inputs.push(input);
      const [identity] = Behavon.useState(() => {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        identities += 1;
        return identities;
      });
      return { input, identity };
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), null);
    const observed = observeBoundary(instance);
    expect(observed.state).toEqual({ status: "active", output: { input: null, identity: 1 } });

    observed.setInput("value");
    await waitFor(() => observed.state.status === "active" && observed.state.output.input === "value");
    observed.setInput(null);
    await waitFor(() => inputs.length === 3);

    expect(inputs).toEqual([null, "value", null]);
    expect(observed.state).toEqual({ status: "active", output: { input: null, identity: 1 } });
    expect(identities).toBe(1);
    observed.dispose();
    instance.dispose();
  });

  it("keeps a pending null input through failure until reset creates a fresh Child", async () => {
    const attempts: Array<string | null> = [];
    function Child(input: string | null): string {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      attempts.push(input);
      if (input === "fail") throw new Error("failed");
      return input ?? "null";
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), "fail");
    const observed = observeBoundary(instance);
    expect(observed.state.status).toBe("failed");
    const reset = observed.state.status === "failed" ? observed.state.reset : () => undefined;

    observed.setInput(null);
    await waitFor(() => inspectModelInstanceForTests(instance).input === null);
    expect(observed.state.status).toBe("failed");
    expect(attempts).toEqual(["fail"]);

    reset();
    await waitFor(() => observed.state.status === "active");
    expect(observed.state).toEqual({ status: "active", output: "null" });
    expect(attempts).toEqual(["fail", null]);
    observed.dispose();
    instance.dispose();
  });

  it("keeps failed input pending and batches reset with the latest input into one fresh Child", async () => {
    const attempts: number[] = [];
    function Child(input: number): number {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      attempts.push(input);
      if (input < 0) throw new Error(`negative:${input}`);
      return input;
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), -1);
    const originalOuter = instance;
    const observed = observeBoundary(instance);
    expect(observed.state.status).toBe("failed");
    const firstFailureState = observed.state;
    const firstReset = firstFailureState.status === "failed" ? firstFailureState.reset : () => undefined;

    observed.setInput(-2);
    await waitFor(() => inspectModelInstanceForTests(instance).input === -2);
    expect(attempts).toEqual([-1]);
    expect(observed.state).toBe(firstFailureState);

    observed.setInput(3);
    firstReset();
    await waitFor(() => observed.state.status === "active");
    expect(observed.state).toEqual({ status: "active", output: 3 });
    expect(attempts).toEqual([-1, 3]);
    expect(instance).toBe(originalOuter);

    observed.setInput(-4);
    await waitFor(() => observed.state.status === "failed");
    const secondFailureState = observed.state;
    firstReset();
    await Promise.resolve();
    expect(observed.state).toBe(secondFailureState);
    expect(attempts).toEqual([-1, 3, -4]);

    const finalReset = secondFailureState.status === "failed" ? secondFailureState.reset : () => undefined;
    observed.dispose();
    instance.dispose();
    finalReset();
    expect(() => observed.setInput(5)).toThrow(/live Model instance/);
  });

  it("keeps BoundaryState identity when a successful Child output is Object.is-equal", async () => {
    const output = Object.freeze({ stable: true });
    let childEvaluations = 0;
    function Child(_input: number): typeof output {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      childEvaluations += 1;
      return output;
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), 1);
    const observed = observeBoundary(instance);
    const firstState = observed.state;
    expect(observed.evaluations).toBe(1);

    observed.setInput(2);
    await waitFor(() => childEvaluations === 2);
    expect(observed.state).toBe(firstState);
    expect(observed.evaluations).toBe(1);

    observed.dispose();
    instance.dispose();
  });

  it("publishes an autonomous Child state commit through the outer Boundary instance", async () => {
    let setChildState: StateSetter<number> | undefined;
    function Child(initial: number): number {
      const [value, setValue] = Behavon.useState(initial);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setChildState = setValue;
      return value;
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), 0);
    const observed = observeBoundary(instance);
    expect(observed.state).toEqual({ status: "active", output: 0 });

    (setChildState as StateSetter<number>)(1);
    await waitFor(() => observed.state.status === "active" && observed.state.output === 1);
    expect(observed.state).toEqual({ status: "active", output: 1 });

    observed.dispose();
    instance.dispose();
  });

  it("keeps outer identity stable when an autonomous Child commit has Object.is-equal output", async () => {
    const output = Object.freeze({ stable: true });
    let childEvaluations = 0;
    let setChildState: StateSetter<number> | undefined;
    function Child(): typeof output {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      childEvaluations += 1;
      const [, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setChildState = setValue;
      return output;
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), undefined);
    const observed = observeBoundary(instance);
    const initialState = observed.state;
    expect(observed.evaluations).toBe(1);

    (setChildState as StateSetter<number>)(1);
    await waitFor(() => childEvaluations === 2);
    expect(observed.state).toBe(initialState);
    expect(observed.evaluations).toBe(1);

    observed.dispose();
    instance.dispose();
  });

  it("publishes autonomous external-store commits through the outer Boundary instance", async () => {
    let value = 0;
    const listeners = new Set<() => void>();
    const subscribe = (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    function Child(): number {
      const snapshot = Behavon.useSyncExternalStore(subscribe, () => value);
      return snapshot;
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), undefined);
    const observed = observeBoundary(instance);
    expect(observed.state).toEqual({ status: "active", output: 0 });

    value = 1;
    for (const listener of listeners) listener();
    await waitFor(() => observed.state.status === "active" && observed.state.output === 1);

    observed.dispose();
    instance.dispose();
  });

  it("propagates nested external-store success through every Boundary wrapper", async () => {
    let value = 0;
    const listeners = new Set<() => void>();
    const subscribe = (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    function Child(): number {
      const snapshot = Behavon.useSyncExternalStore(subscribe, () => value);
      return snapshot;
    }

    const instance = Behavon.createModel(Behavon.boundary(Behavon.boundary(Child)), undefined);
    const observed = observeBoundary(instance);
    expect(observed.state).toEqual({
      status: "active",
      output: { status: "active", output: 0 },
    });

    value = 1;
    for (const listener of listeners) listener();
    await waitFor(() =>
      observed.state.status === "active" &&
      observed.state.output.status === "active" &&
      observed.state.output.output === 1
    );

    observed.dispose();
    instance.dispose();
  });

  it("propagates a nested Child evaluation failure to the public outer output", async () => {
    const failure = new Error("nested evaluation");
    let setFail: StateSetter<boolean> | undefined;
    function Child(): string {
      const [fail, updateFail] = Behavon.useState(false);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setFail = updateFail;
      if (fail) throw failure;
      return "ok";
    }

    const instance = Behavon.createModel(Behavon.boundary(Behavon.boundary(Child)), undefined);
    const observed = observeBoundary(instance);
    expect(observed.state).toEqual({
      status: "active",
      output: { status: "active", output: "ok" },
    });

    (setFail as StateSetter<boolean>)(true);
    await waitFor(() =>
      observed.state.status === "active" && observed.state.output.status === "failed"
    );
    if (observed.state.status === "active") {
      expect(observed.state.output).toMatchObject({ status: "failed", error: failure });
    }

    observed.dispose();
    instance.dispose();
  });

  it("propagates a nested Effect setup failure to the public outer output", async () => {
    const failure = new Error("nested effect setup");
    let setFail: StateSetter<boolean> | undefined;
    function Child(): string {
      const [fail, updateFail] = Behavon.useState(false);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setFail = updateFail;
      Behavon.useEffect(() => {
        if (fail) throw failure;
      }, [fail]);
      return "ok";
    }

    const instance = Behavon.createModel(Behavon.boundary(Behavon.boundary(Child)), undefined);
    const observed = observeBoundary(instance);
    (setFail as StateSetter<boolean>)(true);
    await waitFor(() =>
      observed.state.status === "active" && observed.state.output.status === "failed"
    );
    if (observed.state.status === "active") {
      expect(observed.state.output).toMatchObject({ status: "failed", error: failure });
    }

    observed.dispose();
    instance.dispose();
  });

  it("keeps ordered same-Boundary commit failures inside the nested Boundary", async () => {
    const first = new Error("first setup");
    const second = new Error("second setup");
    function Child(): string {
      Behavon.useEffect(() => {
        throw first;
      }, []);
      Behavon.useEffect(() => {
        throw second;
      }, []);
      return "committed";
    }

    const instance = Behavon.createModel(Behavon.boundary(Behavon.boundary(Child)), undefined);
    const observed = observeBoundary(instance);
    await waitFor(() =>
      observed.state.status === "active" && observed.state.output.status === "failed"
    );

    expect(observed.state.status).toBe("active");
    if (observed.state.status !== "active" || observed.state.output.status !== "failed") {
      throw new Error("Expected only the nested Boundary to fail");
    }
    expect(observed.state.output.error).toBeInstanceOf(AggregateError);
    expect((observed.state.output.error as AggregateError).errors).toEqual([first, second]);
    expect(inspectModelInstanceForTests(instance).status).toBe("active");

    observed.dispose();
    instance.dispose();
  });

  it("makes an inner reset and recovery visible through a nested outer Boundary", async () => {
    const failure = new Error("recoverable nested failure");
    let shouldFail = true;
    function Child(): string {
      if (shouldFail) throw failure;
      return "recovered";
    }

    const instance = Behavon.createModel(Behavon.boundary(Behavon.boundary(Child)), undefined);
    const observed = observeBoundary(instance);
    expect(observed.state.status).toBe("active");
    if (observed.state.status !== "active" || observed.state.output.status !== "failed") {
      throw new Error("Expected the inner Boundary failure");
    }
    const reset = observed.state.output.reset;
    shouldFail = false;
    reset();
    await waitFor(() =>
      observed.state.status === "active" &&
      observed.state.output.status === "active" &&
      observed.state.output.output === "recovered"
    );

    observed.dispose();
    instance.dispose();
  });

  it.each([
    ["input then reset", false, 1],
    ["reset then input", true, 2],
  ] as const)("uses latest input for %s ordering", async (_label, resetFirst, nextInput) => {
    const attempts: number[] = [];
    function Child(input: number): number {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      attempts.push(input);
      if (input < 0) throw new Error("initial failure");
      return input;
    }

    const instance = Behavon.createModel(Behavon.boundary(Child), -1);
    const observed = observeBoundary(instance);
    if (observed.state.status !== "failed") throw new Error("Expected initial failure");
    const reset = observed.state.reset;
    if (resetFirst) {
      reset();
      observed.setInput(nextInput);
    } else {
      observed.setInput(nextInput);
      reset();
    }
    await waitFor(() => observed.state.status === "active");
    expect(observed.state).toEqual({ status: "active", output: nextInput });
    expect(attempts).toEqual([-1, nextInput]);

    observed.dispose();
    instance.dispose();
  });

  it("uses the nearest nested Boundary and preserves an undefined thrown value", () => {
    function Broken(): never {
      throw undefined;
    }
    const Nested = Behavon.boundary(Behavon.boundary(Broken));
    const instance = Behavon.createModel(Nested, undefined);
    const observed = observeBoundary(instance);

    expect(observed.state.status).toBe("active");
    if (observed.state.status === "active") {
      expect(observed.state.output).toMatchObject({ status: "failed", error: undefined });
    }

    observed.dispose();
    instance.dispose();
  });

  it("contains post-commit failure and cascades outer disposal to the active Child", async () => {
    const failure = new Error("effect setup");
    function BrokenEffect(): undefined {
      Behavon.useEffect(() => {
        throw failure;
      }, []);
      return undefined;
    }

    const failedInstance = Behavon.createModel(Behavon.boundary(BrokenEffect), undefined);
    const failedObservation = observeBoundary(failedInstance);
    await waitFor(() => failedObservation.state.status === "failed");
    expect(failedObservation.state).toMatchObject({ status: "failed", error: failure });
    failedObservation.dispose();
    failedInstance.dispose();

    let cleanups = 0;
    function ActiveEffect(): undefined {
      Behavon.useEffect(() => () => {
        cleanups += 1;
      }, []);
      return undefined;
    }
    const activeInstance = Behavon.createModel(Behavon.boundary(ActiveEffect), undefined);
    activeInstance.dispose();
    expect(cleanups).toBe(1);
  });
});
