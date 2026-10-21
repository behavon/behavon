import Behavon, { type Model, type Signal, type SnapshotRootId } from "behavon";

/** What the screen needs, published as one snapshot. */
export interface CounterView {
  readonly count: number;
  readonly isZero: boolean;
}

export interface CounterPort {
  view: SnapshotRootId<CounterView>;
  increment: Signal;
  decrement: Signal;
  add: Signal<[amount: number]>;
  reset: Signal;
}

const counterPort = Behavon.createPort<CounterPort>({
  view: Behavon.SnapshotType(),
  increment: Behavon.SignalType(),
  decrement: Behavon.SignalType(),
  add: Behavon.SignalType(),
  reset: Behavon.SignalType(),
});

/** A counter that starts at `initial`. */
export const Counter: Model<number, number, CounterPort> = (initial) => {
  const viewId = Behavon.useExport(counterPort, "view");
  const [count, setCount] = Behavon.useState(initial);
  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ count, isZero: count === 0 });
  }, [count, publish]);

  const increment = Behavon.useCallback(() => setCount((n) => n + 1), [setCount]);
  Behavon.useSignal(counterPort, "increment", increment);
  Behavon.useExport(counterPort, "increment");

  const decrement = Behavon.useCallback(() => setCount((n) => n - 1), [setCount]);
  Behavon.useSignal(counterPort, "decrement", decrement);
  Behavon.useExport(counterPort, "decrement");

  const add = Behavon.useCallback((amount: number) => setCount((n) => n + amount), [setCount]);
  Behavon.useSignal(counterPort, "add", add);
  Behavon.useExport(counterPort, "add");

  const reset = Behavon.useCallback(() => setCount(initial), [initial, setCount]);
  Behavon.useSignal(counterPort, "reset", reset);
  Behavon.useExport(counterPort, "reset");

  return count;
};
