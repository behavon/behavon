import Behavon from "behavon";
import type { Model, Signal } from "behavon";

interface FirstPort {
  first: Signal;
}

interface SecondPort {
  second: Signal;
}

const firstPort = Behavon.createPort<FirstPort>({ first: Behavon.SignalType() });
const secondPort = Behavon.createPort<SecondPort>({ second: Behavon.SignalType() });

interface BaseModels {
  Wrong: Model<undefined, undefined, FirstPort>;
  Missing: Model<undefined, undefined, FirstPort>;
  Mixed: Model<undefined, undefined, FirstPort>;
}

interface ExtendedModels extends BaseModels {}
type IntersectedModels = BaseModels & {};

export const ExtendedContextualModels: ExtendedModels = {
  Wrong: () => {
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
  Missing: () => undefined,
  Mixed: () => {
    const first = Behavon.useCallback(() => undefined, []);
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
};

export const IntersectedContextualModels: IntersectedModels = {
  Wrong: () => {
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
  Missing: () => undefined,
  Mixed: () => {
    const first = Behavon.useCallback(() => undefined, []);
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
};
