import Behavon from "behavon";
import type { BoundaryState, Model, Signal } from "behavon";

interface ChildPort {
  fire: Signal;
}

const childPort = Behavon.createPort<ChildPort>({ fire: Behavon.SignalType() });

const Child: Model<undefined, number, ChildPort> = () => {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(childPort, "fire", fire);
  return 1;
};

const SafeBoundary = Behavon.boundary(Child);

// @ts-expect-error A Boundary result does not preserve its Child Port.
const UnsafeDirect: Model<undefined, BoundaryState<number>, ChildPort> = Behavon.boundary(Child);

// @ts-expect-error A Boundary alias remains schema-less.
const UnsafeAlias: Model<undefined, BoundaryState<number>, ChildPort> = SafeBoundary;

const UnsafeObjectNoCall: {
  Outer: Model<undefined, BoundaryState<number>, ChildPort>;
} = {
  // @ts-expect-error A contextual object member cannot add the Child Port to a Boundary.
  Outer: Behavon.boundary(Child),
};

const UnsafeObjectCall: {
  Outer: Model<undefined, BoundaryState<number>, ChildPort>;
} = {
  // @ts-expect-error A called contextual object member is still schema-less.
  Outer: Behavon.boundary(Child),
};

const UnsafeTuple: readonly [
  Model<undefined, BoundaryState<number>, ChildPort>,
] = [
  // @ts-expect-error A contextual tuple element cannot add a Boundary Port.
  Behavon.boundary(Child),
];

Behavon.createModel(UnsafeObjectCall.Outer, undefined);
Behavon.createModel(
  SafeBoundary as Model<undefined, BoundaryState<number>, ChildPort>,
  undefined,
);
// @ts-expect-error An explicit createModel Port cannot be supplied by a schema-less Boundary.
Behavon.createModel<undefined, BoundaryState<number>, ChildPort>(SafeBoundary, undefined);

export default Behavon.boundary(Child) as Model<
  undefined,
  BoundaryState<number>,
  ChildPort
>;
