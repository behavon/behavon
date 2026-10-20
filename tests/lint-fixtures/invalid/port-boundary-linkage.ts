import Behave from "behavon";
import type { BoundaryState, Model, Signal } from "behavon";

interface ChildPort {
  fire: Signal;
}

const childPort = Behave.createPort<ChildPort>({ fire: Behave.SignalType() });

const Child: Model<undefined, number, ChildPort> = () => {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(childPort, "fire", fire);
  return 1;
};

const SafeBoundary = Behave.boundary(Child);

// @ts-expect-error A Boundary result does not preserve its Child Port.
const UnsafeDirect: Model<undefined, BoundaryState<number>, ChildPort> = Behave.boundary(Child);

// @ts-expect-error A Boundary alias remains schema-less.
const UnsafeAlias: Model<undefined, BoundaryState<number>, ChildPort> = SafeBoundary;

const UnsafeObjectNoCall: {
  Outer: Model<undefined, BoundaryState<number>, ChildPort>;
} = {
  // @ts-expect-error A contextual object member cannot add the Child Port to a Boundary.
  Outer: Behave.boundary(Child),
};

const UnsafeObjectCall: {
  Outer: Model<undefined, BoundaryState<number>, ChildPort>;
} = {
  // @ts-expect-error A called contextual object member is still schema-less.
  Outer: Behave.boundary(Child),
};

const UnsafeTuple: readonly [
  Model<undefined, BoundaryState<number>, ChildPort>,
] = [
  // @ts-expect-error A contextual tuple element cannot add a Boundary Port.
  Behave.boundary(Child),
];

Behave.createModel(UnsafeObjectCall.Outer, undefined);
Behave.createModel(
  SafeBoundary as Model<undefined, BoundaryState<number>, ChildPort>,
  undefined,
);
// @ts-expect-error An explicit createModel Port cannot be supplied by a schema-less Boundary.
Behave.createModel<undefined, BoundaryState<number>, ChildPort>(SafeBoundary, undefined);

export default Behave.boundary(Child) as Model<
  undefined,
  BoundaryState<number>,
  ChildPort
>;
