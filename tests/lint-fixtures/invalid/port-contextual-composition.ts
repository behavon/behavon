import Behave from "behavon";
import type { Model, Signal } from "behavon";

interface FirstPort {
  first: Signal;
}

interface SecondPort {
  second: Signal;
}

const firstPort = Behave.createPort<FirstPort>({ first: Behave.SignalType() });
const secondPort = Behave.createPort<SecondPort>({ second: Behave.SignalType() });

interface BaseModels {
  Wrong: Model<undefined, undefined, FirstPort>;
  Missing: Model<undefined, undefined, FirstPort>;
  Mixed: Model<undefined, undefined, FirstPort>;
}

interface ExtendedModels extends BaseModels {}
type IntersectedModels = BaseModels & {};

export const ExtendedContextualModels: ExtendedModels = {
  Wrong: () => {
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
  Missing: () => undefined,
  Mixed: () => {
    const first = Behave.useCallback(() => undefined, []);
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
};

export const IntersectedContextualModels: IntersectedModels = {
  Wrong: () => {
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
  Missing: () => undefined,
  Mixed: () => {
    const first = Behave.useCallback(() => undefined, []);
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
};
