import { describe, expect, it, vi } from "vitest";
import Behave from "behavon";
import type { Model, ModelInstance, ReducerDispatch, Signal, StateSetter } from "behavon";
import { inspectModelInstanceForTests, inspectRetainedOperationForTests } from "../../src/internal/model-inspection";
import { inspectMutableStateForTests, type MutableStateSubject } from "../../src/internal/mutable-observer";
import { waitFor } from "../helpers";

function outputOf<Value>(ref: object): Value {
  return inspectModelInstanceForTests(ref).output as Value;
}

async function captureScheduledFailure(action: () => void): Promise<unknown> {
  let surfaced: unknown;
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
    try {
      if (typeof handler === "function") handler();
    } catch (error: unknown) {
      surfaced = error;
    }
    return originalSetTimeout(() => undefined, 0);
  }) as typeof setTimeout;
  try {
    action();
    await Promise.resolve();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  return surfaced;
}

describe("useReducer", () => {
  it("rejects malformed reducer, initializer, and multi-action dispatch calls", () => {
    function InvalidReducer(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- test-only invalid reproduction exercises the runtime guard before result use
      Behave.useReducer(null as never, 0);
      return undefined;
    }
    expect(() => Behave.createModel(InvalidReducer, undefined)).toThrow(
      "Behave.useReducer requires a reducer function",
    );

    function InvalidInitializer(): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- test-only invalid reproduction exercises the runtime guard before result use
      Behave.useReducer((state: number) => state, 0, 1 as never);
      return undefined;
    }
    expect(() => Behave.createModel(InvalidInitializer, undefined)).toThrow(
      "Behave.useReducer initializer must be a function when provided",
    );

    let dispatch: ReducerDispatch<[number]> | undefined;
    function Counter(): number {
      const [value, next] = Behave.useReducer((state: number, action: number) => state + action, 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains dispatch for a cast-invalid call
      dispatch = next;
      return value;
    }
    const owner = Behave.createModel(Counter, undefined);
    expect(() => (dispatch as (...actions: number[]) => void)(1, 2)).toThrow(
      "Behave.useReducer dispatch accepts zero or one action argument",
    );
    expect(outputOf<number>(owner)).toBe(0);
    owner.dispose();
  });

  it("preserves initializer error identity before publishing a Model", () => {
    const failure = new Error("initializer failed");
    function Broken(): number {
      const [value] = Behave.useReducer(
        (state: number, action: number) => state + action,
        0,
        () => { throw failure; },
      );
      return value;
    }
    expect(() => Behave.createModel(Broken, undefined)).toThrow(failure);
  });

  it("releases a failed-construction reducer cell and rejects Hooks in its initializer", () => {
    const failure = new Error("construction failed after reducer");
    let escapedDispatch: ReducerDispatch<[number]> | undefined;
    let provisionalCell: MutableStateSubject | undefined;
    function Broken(): never {
      const [, dispatch] = Behave.useReducer((state: number, action: number) => state + action, 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains provisional reducer authority
      escapedDispatch = dispatch;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains provisional reducer cell
      provisionalCell = inspectRetainedOperationForTests(dispatch).cell as MutableStateSubject;
      throw failure;
    }
    expect(() => Behave.createModel(Broken, undefined)).toThrow(failure);
    expect(inspectMutableStateForTests(provisionalCell as MutableStateSubject).status).toBe("released");
    expect(inspectRetainedOperationForTests(escapedDispatch as Function).cell).toBeUndefined();
    expect(() => escapedDispatch?.(1)).not.toThrow();

    function InvalidInitializer(): number {
      const [value] = Behave.useReducer(
        (state: number, action: number) => state + action,
        0,
        () => {
          // eslint-disable-next-line behavon-hooks/canonical-api, react-hooks/rules-of-hooks -- test-only invalid reproduction verifies initializer Hook rejection
          Behave.useState(0);
          return 0;
        },
      );
      return value;
    }
    expect(() => Behave.createModel(InvalidInitializer, undefined)).toThrow(
      /useState cannot be called inside useReducer initializer/,
    );
  });

  it("initializes once, preserves a stable void dispatch, and applies ordered actions", async () => {
    let initializations = 0;
    let dispatch: ReducerDispatch<[number]> | undefined;
    const returns: unknown[] = [];
    const identities: Function[] = [];

    function Counter(): number {
      const [count, next] = Behave.useReducer(
        (state: number, action: number) => state + action,
        "2",
        (value) => {
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe counts initializer calls
          initializations += 1;
          return Number(value);
        },
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains public dispatch identity
      dispatch = next;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records stable identities
      identities.push(next);
      return count;
    }

    const instance = Behave.createModel(Counter, undefined);
    returns.push(dispatch?.(3), dispatch?.(4));
    await waitFor(() => outputOf<number>(instance as object) === 9);
    expect(initializations).toBe(1);
    expect(returns).toEqual([undefined, undefined]);
    expect(identities[1]).toBe(identities[0]);
    instance.dispose();
  });

  it("supports zero-argument reducers and treats function actions as ordinary actions", async () => {
    let tick: ReducerDispatch<[]> | undefined;
    let send: ReducerDispatch<[() => number]> | undefined;
    function Model(): readonly [number, number] {
      const [count, next] = Behave.useReducer((state: number) => state + 1, 0);
      const [functionValue, nextFunction] = Behave.useReducer(
        (_state: number, action: () => number) => action(),
        0,
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains dispatches
      [tick, send] = [next, nextFunction];
      return [count, functionValue];
    }
    const instance = Behave.createModel(Model, undefined);
    tick?.();
    send?.(() => 7);
    await waitFor(() => outputOf<readonly [number, number]>(instance as object)[1] === 7);
    expect(outputOf<readonly [number, number]>(instance as object)).toEqual([1, 7]);
    instance.dispose();
  });

  it("uses the latest evaluation reducer for pending actions and bails out with Object.is", async () => {
    let mode = 1;
    let dispatch: ReducerDispatch<[number]> | undefined;
    let evaluations = 0;
    function Model(): number {
      const [value, next] = Behave.useReducer(
        (state: number, action: number) => state + action * mode,
        0,
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluations
      evaluations += 1;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains dispatch
      dispatch = next;
      return value;
    }
    const instance = Behave.createModel(Model, undefined);
    mode = 2;
    dispatch?.(3);
    await waitFor(() => outputOf<number>(instance as object) === 6);
    dispatch?.(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(outputOf<number>(instance as object)).toBe(6);
    expect(evaluations).toBe(3);
    instance.dispose();
  });

  it("keeps one MutableObserver identity and initializer result across retry and commit", async () => {
    let dispatch: ReducerDispatch<[number]> | undefined;
    let initializations = 0;
    const seen: number[] = [];
    const identities: Array<readonly [number, number]> = [];
    function Model(): number {
      const [value, next] = Behave.useReducer(
        (state: number, action: number) => state + action,
        0,
        (initial) => {
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe counts retry-safe initialization
          initializations += 1;
          return initial;
        },
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records retry progression
      seen.push(value);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains dispatch
      dispatch = next;
      const currentCell = inspectRetainedOperationForTests(next).cell as MutableStateSubject;
      const metadata = inspectMutableStateForTests(currentCell);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records observer identity across retry and commit
      identities.push([metadata.identity, metadata.generation]);
      if (value < 2) next(1);
      return value;
    }
    const instance = Behave.createModel(Model, undefined);
    const cell = inspectRetainedOperationForTests(dispatch as Function).cell as MutableStateSubject;
    expect(seen).toEqual([0, 1, 2]);
    expect(initializations).toBe(1);
    expect(new Set(identities.map((identity) => identity.join(":"))).size).toBe(1);
    dispatch?.(1);
    await waitFor(() => outputOf<number>(instance as object) === 3);
    expect(identities.at(-1)).toEqual(identities[0]);
    expect(inspectMutableStateForTests(cell)).toMatchObject({
      status: "live",
      queuedUpdates: 0,
      labeled: false,
      locked: false,
    });
    instance.dispose();
    expect(inspectMutableStateForTests(cell).status).toBe("released");
    expect(() => dispatch?.(1)).not.toThrow();
  });

  it("rejects mounted state-to-reducer and reducer-to-state hook kind changes", async () => {
    let stateToReducer = false;
    let rerenderStateOwner: StateSetter<number> | undefined;
    function StateThenReducer(): number {
      const [tick, setTick] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only invalid reproduction retains a rerender trigger
      rerenderStateOwner = setTick;
      if (stateToReducer) {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- test-only invalid reproduction changes a mounted Hook kind
        const [value] = Behave.useReducer((state: number) => state, 0);
        return value + tick;
      }
      // eslint-disable-next-line react-hooks/rules-of-hooks -- test-only invalid reproduction changes a mounted Hook kind
      const [value] = Behave.useState(0);
      return value + tick;
    }

    const stateOwner = Behave.createModel(StateThenReducer, undefined);
    stateToReducer = true;
    expect(await captureScheduledFailure(() => rerenderStateOwner?.((value) => value + 1))).toMatchObject({
      message: expect.stringMatching(/Behave hook order changed in Model#\d+: expected state, received reducer/),
    });
    expect(inspectModelInstanceForTests(stateOwner as object).status).toBe("disposed");

    let reducerToState = false;
    let rerenderReducerOwner: StateSetter<number> | undefined;
    function ReducerThenState(): number {
      const [tick, setTick] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only invalid reproduction retains a rerender trigger
      rerenderReducerOwner = setTick;
      if (reducerToState) {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- test-only invalid reproduction changes a mounted Hook kind
        const [value] = Behave.useState(0);
        return value + tick;
      }
      // eslint-disable-next-line react-hooks/rules-of-hooks -- test-only invalid reproduction changes a mounted Hook kind
      const [value] = Behave.useReducer((state: number) => state, 0);
      return value + tick;
    }

    const reducerOwner = Behave.createModel(ReducerThenState, undefined);
    reducerToState = true;
    expect(await captureScheduledFailure(() => rerenderReducerOwner?.((value) => value + 1))).toMatchObject({
      message: expect.stringMatching(/Behave hook order changed in Model#\d+: expected reducer, received state/),
    });
    expect(inspectModelInstanceForTests(reducerOwner as object).status).toBe("disposed");
  });

  it("discards reducer-enqueued failure suffixes while preserving the external prefix", async () => {
    const failure = new Error("reducer suffix failure");
    let dispatch: ReducerDispatch<["prefix" | "suffix"]> | undefined;
    let cell: MutableStateSubject | undefined;
    function Model(): number {
      const [value, next] = Behave.useReducer((state: number, action: "prefix" | "suffix") => {
        if (action === "prefix") {
          dispatch?.("suffix");
          throw failure;
        }
        return state + 1;
      }, 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains failed queue authority
      dispatch = next;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains failed reducer cell
      cell = inspectRetainedOperationForTests(next).cell as MutableStateSubject;
      return value;
    }
    const instance = Behave.createModel(Model, undefined);
    expect(await captureScheduledFailure(() => dispatch?.("prefix"))).toBe(failure);
    expect(inspectModelInstanceForTests(instance as object).status).toBe("disposed");
    expect(inspectMutableStateForTests(cell as MutableStateSubject)).toMatchObject({
      status: "released",
      queuedUpdates: 1,
    });
    expect(cell?.queue).toEqual([["prefix"]]);
    expect(inspectRetainedOperationForTests(dispatch as Function).cell).toBeUndefined();
  });

  it("stops a non-converging render-phase reducer after 25 attempts", () => {
    let attempts = 0;
    function Loop(): never {
      const [, dispatch] = Behave.useReducer((state: number) => state + 1, 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe counts bounded retry attempts
      attempts += 1;
      dispatch();
      throw new Error("unreachable candidate");
    }
    expect(() => Behave.createModel(Loop, undefined)).toThrow(/unreachable candidate/);
    expect(attempts).toBe(1);

    attempts = 0;
    function PureLoop(): number {
      const [value, dispatch] = Behave.useReducer((state: number) => state + 1, 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe counts bounded retry attempts
      attempts += 1;
      dispatch();
      return value;
    }
    expect(() => Behave.createModel(PureLoop, undefined)).toThrow(/exceeded 25 render-phase evaluation attempts/);
    expect(attempts).toBe(25);
  });

  it("rejects cross-owner reducer dispatch during evaluation without terminating the target", () => {
    let dispatch: ReducerDispatch<[number]> | undefined;
    function Target(): number {
      const [value, next] = Behave.useReducer((state: number, action: number) => state + action, 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe shares dispatch for cross-owner runtime validation
      dispatch = next;
      return value;
    }
    const target = Behave.createModel(Target, undefined);
    function InvalidSource(): undefined {
      dispatch?.(1);
      return undefined;
    }
    expect(() => Behave.createModel(InvalidSource, undefined)).toThrow(/useReducer setter for target Model#.*cannot be called/);
    expect(outputOf<number>(target as object)).toBe(0);
    dispatch?.(2);
    target.dispose();
  });

  it("preserves reducer error identity and rejects nested Hooks", async () => {
    const failure = new Error("reducer failed");
    let dispatch: ReducerDispatch<["fail" | "hook"]> | undefined;
    function Model(): number {
      const [value, next] = Behave.useReducer((state: number, action: "fail" | "hook") => {
        if (action === "fail") throw failure;
        // eslint-disable-next-line behavon-hooks/canonical-api, react-hooks/rules-of-hooks -- test-only invalid reproduction verifies runtime nested-Hook rejection
        Behave.useState(0);
        return state;
      }, 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains dispatch
      dispatch = next;
      return value;
    }
    const first = Behave.createModel(Model, undefined);
    let surfaced: unknown;
    const original = globalThis.setTimeout;
    globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
      try {
        if (typeof handler === "function") handler();
      } catch (error: unknown) {
        surfaced = error;
      }
      return original(() => undefined, 0);
    }) as typeof setTimeout;
    try {
      dispatch?.("fail");
      await Promise.resolve();
    } finally {
      globalThis.setTimeout = original;
    }
    expect(surfaced).toBe(failure);

    const second = Behave.createModel(Model, undefined);
    surfaced = undefined;
    globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
      try {
        if (typeof handler === "function") handler();
      } catch (error: unknown) {
        surfaced = error;
      }
      return original(() => undefined, 0);
    }) as typeof setTimeout;
    try {
      dispatch?.("hook");
      await Promise.resolve();
    } finally {
      globalThis.setTimeout = original;
    }
    expect(String(surfaced)).toMatch(/useState cannot be called inside useReducer reducer/);
    expect(() => first.dispose()).toThrow(/more than once/);
    expect(() => second.dispose()).toThrow(/more than once/);
  });

  it("routes reducer failures to the nearest outer Boundary with original identity", async () => {
    const failure = new Error("contained reducer failure");
    let dispatch: ReducerDispatch<["fail"]> | undefined;
    function Child(): number {
      const [value, next] = Behave.useReducer((state: number, action: "fail") => {
        if (action === "fail") throw failure;
        return state;
      }, 0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains dispatch for Boundary failure
      dispatch = next;
      return value;
    }
    const boundary = Behave.createModel(Behave.boundary(Child), undefined);
    dispatch?.("fail");
    await waitFor(() => (
      outputOf<{ readonly status: string }>(boundary as object).status === "failed"
    ));
    const result = outputOf<{ readonly status: string; readonly error: unknown }>(boundary as object);
    expect(result.status).toBe("failed");
    expect(result.error).toBe(failure);
    boundary.dispose();
  });

  it("defers transaction-run dispatch across both commit and rollback with one development warning", async () => {
    interface Port { execute: Signal<[rollback: boolean]> }
    const port = Behave.createPort<Port>({ execute: Behave.SignalType() });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const Model = () => {
      const [value, dispatch] = Behave.useReducer((state: number, action: number) => state + action, 0);
      const execute = Behave.useCallback((rollback: boolean) => {
        const id = Behave.createId();
        Behave.transaction.start(id, []);
        Behave.transaction.run(id, () => {
          dispatch(1);
          dispatch(2);
        });
        if (rollback) Behave.transaction.rollback(id);
        else Behave.transaction.commit(id);
      }, [dispatch]);
      Behave.useSignal(port, "execute", execute);
      return value;
    };
    const instance = Behave.createModel(Model, undefined);
    instance.execute(true);
    await waitFor(() => outputOf<number>(instance as object) === 3);
    instance.execute(false);
    await waitFor(() => outputOf<number>(instance as object) === 6);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(String(warning.mock.calls[0]?.[0])).toMatch(/useReducer dispatch.*nontransactional/);
    warning.mockRestore();
    instance.dispose();
  });

  it("releases deferred reducer actions after commit evaluation failure without reviving a terminal owner", async () => {
    const failure = new Error("transaction reducer evaluation failed");
    interface TargetPort { add: Signal<[amount: number]> }
    interface FailingPort { execute: Signal }
    const targetPort = Behave.createPort<TargetPort>({ add: Behave.SignalType() });
    const failingPort = Behave.createPort<FailingPort>({ execute: Behave.SignalType() });
    const stateIds = Behave.createId({ failed: Behave.StateType<boolean>() });

    const Target: Model<undefined, number, TargetPort> = () => {
      const [value, dispatch] = Behave.useReducer(
        (state: number, amount: number) => state + amount,
        0,
      );
      const add = Behave.useCallback((amount: number) => dispatch(amount), [dispatch]);
      Behave.useSignal(targetPort, "add", add);
      return value;
    };
    const Failing: Model<{
      target: ModelInstance<undefined, number, TargetPort>;
    }, boolean, FailingPort> = (input) => {
      const [failed, setFailed] = Behave.useLabelState(stateIds.failed, false);
      if (failed) throw failure;
      const target = input.target;
      const execute = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [stateIds.failed]);
        Behave.transaction.run(id, () => {
          setFailed(true);
          target.add(7);
        });
        Behave.transaction.commit(id);
      }, [setFailed, target]);
      Behave.useSignal(failingPort, "execute", execute);
      return failed;
    };

    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const target = Behave.createModel(Target, undefined);
    const failing = Behave.createModel(Failing, { target });
    expect(() => failing.execute()).toThrow(failure);
    await waitFor(() => outputOf<number>(target as object) === 7);
    expect(outputOf<number>(target as object)).toBe(7);
    expect(inspectModelInstanceForTests(failing as object).status).toBe("disposed");
    expect(warning.mock.calls.some(([message]) => /useReducer dispatch.*nontransactional/.test(String(message)))).toBe(true);
    target.dispose();

    const selfFailure = new Error("terminal reducer owner failed");
    let selfDispatch: ReducerDispatch<[number]> | undefined;
    let selfCell: MutableStateSubject | undefined;
    const Self: Model<undefined, number, FailingPort> = () => {
      const [failed, setFailed] = Behave.useLabelState(stateIds.failed, false);
      const [value, dispatch] = Behave.useReducer(
        (state: number, amount: number) => state + amount,
        0,
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains terminal reducer authority
      selfDispatch = dispatch;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains terminal reducer cell
      selfCell = inspectRetainedOperationForTests(dispatch).cell as MutableStateSubject;
      if (failed) throw selfFailure;
      const execute = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [stateIds.failed]);
        Behave.transaction.run(id, () => {
          setFailed(true);
          dispatch(1);
        });
        Behave.transaction.commit(id);
      }, [dispatch, setFailed]);
      Behave.useSignal(failingPort, "execute", execute);
      return value;
    };
    const self = Behave.createModel(Self, undefined);
    expect(() => self.execute()).toThrow(selfFailure);
    await Promise.resolve();
    await Promise.resolve();
    expect(inspectModelInstanceForTests(self as object)).toMatchObject({
      status: "disposed",
      scheduled: false,
      hooks: [],
    });
    expect(inspectMutableStateForTests(selfCell as MutableStateSubject)).toMatchObject({
      status: "released",
      queuedUpdates: 1,
    });
    expect(inspectRetainedOperationForTests(selfDispatch as Function).cell).toBeUndefined();
    expect(() => selfDispatch?.(1)).not.toThrow();
    warning.mockRestore();
  });
});
