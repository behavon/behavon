import { useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { CounterPort } from "./counter";

export function CounterView({ counter }: { readonly counter: TypedModelRef<CounterPort> }) {
  const view = useSyncExternalStore(
    Behavon.subscribe(counter.view),
    Behavon.getSnapshot(counter.view),
  );
  if (view === undefined) return null;
  return (
    <section>
      <output>{view.count}</output>
      <p>{view.isZero ? "It is 0" : "It is not 0"}</p>
      <button type="button" onClick={() => counter.decrement()}>-1</button>
      <button type="button" onClick={() => counter.increment()}>+1</button>
      <button type="button" onClick={() => counter.add(5)}>+5</button>
      <button type="button" onClick={() => counter.reset()}>Reset</button>
    </section>
  );
}
