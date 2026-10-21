import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { StateSetter } from "behavon";
import {
  inspectModelInstanceForTests,
  inspectRetainedOperationForTests,
} from "../../src/internal/model-inspection";
import {
  inspectMutableStateForTests,
  type MutableStateSubject,
} from "../../src/internal/mutable-observer";
import { waitFor, signalOf } from "../helpers";

function stateCellOf(ref: object): MutableStateSubject {
  const cell = inspectModelInstanceForTests(ref).hooks.find(
    (hook) => (hook as { kind?: string }).kind === "state",
  );
  if (cell === undefined) throw new Error("Expected a StateCell test subject");
  return cell as MutableStateSubject;
}

describe("MutableObserver state mutation authority", () => {
  it("keeps one live identity and generation through enqueue, evaluation, and commit", async () => {
    let observed = -1;

    type CounterPortType = { "increment": PortOnlySignal<any> };
    const counterPort = Behavon.createPort<CounterPortType>({ "increment": Behavon.SignalType() });
    function Counter(): number {
      const [count, setCount] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only observer protocol probe records committed evaluation output
      observed = count;
      const increment = Behavon.useCallback(() => setCount((value) => value + 1), [setCount]);
      Behavon.useSignal(counterPort, "increment", increment);
      Behavon.useExport(counterPort, "increment");
      return count;
    }

    const counter = Behavon.createModel((Counter as unknown as Model<any, any, CounterPortType>), undefined);
    const cell = stateCellOf(counter as object);
    const owner = inspectModelInstanceForTests(counter as object);
    const before = inspectMutableStateForTests(cell);
    expect(before.status).toBe("live");
    expect(before.owner).toBe(owner);
    expect(before.queuedUpdates).toBe(0);

    signalOf(counter, "increment")();
    expect(inspectMutableStateForTests(cell).queuedUpdates).toBe(1);
    await waitFor(() => observed === 1);

    const after = inspectMutableStateForTests(cell);
    expect(after).toMatchObject({
      identity: before.identity,
      generation: before.generation,
      status: "live",
      queuedUpdates: 0,
    });
    counter.dispose();
    expect(inspectMutableStateForTests(cell).status).toBe("released");
  });

  it("assigns distinct identities and generations to separate Model instances", () => {
    function StateModel(): number {
      const [value] = Behavon.useState(0);
      return value;
    }

    const first = Behavon.createModel(StateModel, undefined);
    const second = Behavon.createModel(StateModel, undefined);
    const firstMetadata = inspectMutableStateForTests(stateCellOf(first as object));
    const secondMetadata = inspectMutableStateForTests(stateCellOf(second as object));

    expect(secondMetadata.identity).not.toBe(firstMetadata.identity);
    expect(secondMetadata.generation).not.toBe(firstMetadata.generation);
    first.dispose();
    second.dispose();
  });

  it("keeps the same identity and generation across a render-phase retry", () => {
    const attempts: Array<readonly [identity: number, generation: number]> = [];

    function ConvergingModel(): number {
      const [value, setValue] = Behavon.useState(0);
      const cell = inspectRetainedOperationForTests(setValue).cell as MutableStateSubject;
      const metadata = inspectMutableStateForTests(cell);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only retry probe records observer identity for each attempt
      attempts.push([metadata.identity, metadata.generation]);
      if (value === 0) setValue(1);
      return value;
    }

    const instance = Behavon.createModel(ConvergingModel, undefined);
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    expect(inspectModelInstanceForTests(instance as object).output).toBe(1);
    instance.dispose();
  });

  it("releases a provisional StateCell whose construction fails", () => {
    const failure = new Error("construction failed");
    let escapedSetter: StateSetter<number> | undefined;
    let provisionalCell: MutableStateSubject | undefined;

    function Broken(): never {
      const [, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only provisional lifecycle probe retains the setter and its internal cell
      escapedSetter = setValue;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only provisional lifecycle probe retains the internal cell for post-failure inspection
      provisionalCell = inspectRetainedOperationForTests(setValue).cell as MutableStateSubject;
      throw failure;
    }

    expect(() => Behavon.createModel(Broken, undefined)).toThrow(failure);
    expect(inspectMutableStateForTests(provisionalCell as MutableStateSubject).status).toBe("released");
    expect(inspectRetainedOperationForTests(escapedSetter as Function).cell).toBeUndefined();
    expect(() => escapedSetter?.(1)).not.toThrow();
  });

  it("releases the replaced Boundary Child generation after terminal failure", async () => {
    const failure = new Error("child failed");
    let failChild: StateSetter<boolean> | undefined;
    let childCell: MutableStateSubject | undefined;

    function Child(): undefined {
      const [failed, setFailed] = Behavon.useState(false);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only Boundary generation probe retains the Child setter
      failChild = setFailed;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only Boundary generation probe retains the Child cell
      childCell = inspectRetainedOperationForTests(setFailed).cell as MutableStateSubject;
      if (failed) throw failure;
      return undefined;
    }

    const boundary = Behavon.createModel(Behavon.boundary(Child), undefined);
    const initial = inspectMutableStateForTests(childCell as MutableStateSubject);
    failChild?.(true);
    await waitFor(() => (
      inspectModelInstanceForTests(boundary as object).output as { status?: string }
    ).status === "failed");

    const released = inspectMutableStateForTests(childCell as MutableStateSubject);
    expect(released).toMatchObject({
      identity: initial.identity,
      generation: initial.generation,
      status: "released",
    });
    expect(inspectRetainedOperationForTests(failChild as Function).cell).toBeUndefined();
    boundary.dispose();
  });
});
