import Behave from "behavon";
import type { Model, Signal } from "behavon";
import { importedPort } from "../support/static-port";

interface FirstPort {
  first: Signal;
}

interface SecondPort {
  second: Signal;
}

type FirstModel = Model<undefined, undefined, FirstPort>;

const firstPort = Behave.createPort<FirstPort>({ first: Behave.SignalType() });
const secondPort = Behave.createPort<SecondPort>({ second: Behave.SignalType() });

const BuiltInOnly: Model<undefined, readonly [number, () => undefined], FirstPort> = () => {
  const [state] = Behave.useState(0);
  const callback = Behave.useCallback(() => undefined, []);
  return [state, callback] as const;
};

function UnannotatedProvider(): undefined {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(secondPort, "second", second);
  return undefined;
}

function WrongBody(): undefined {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(secondPort, "second", second);
  return undefined;
}

function ImportedUnannotatedProvider(): undefined {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(importedPort, "fire", fire);
  return undefined;
}

export function ExportedUninstantiatedProvider(): undefined {
  const first = Behave.useCallback(() => undefined, []);
  Behave.useSignal(firstPort, "first", first);
  return undefined;
}

const StaticModels = {
  Wrong: (() => {
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  }) satisfies Model<undefined, undefined, FirstPort>,
};

export const ContextualModels: {
  Provider: Model<undefined, undefined, FirstPort>;
} = {
  Provider: () => {
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
};

export const NonPreservingContextualModels = {
  Provider: () => {
    const first = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    return undefined;
  },
} satisfies {
  Provider: Model<undefined, undefined, FirstPort>;
};

interface ContextualModelInterface {
  Wrong: Model<undefined, undefined, FirstPort>;
  Missing: Model<undefined, undefined, FirstPort>;
  Mixed: Model<undefined, undefined, FirstPort>;
}

export const ContextualInterfaceModels: ContextualModelInterface = {
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

export const ContextualTupleModels: [
  Model<undefined, undefined, FirstPort>,
  Model<undefined, undefined, FirstPort>,
  Model<undefined, undefined, FirstPort>,
] = [
  () => {
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
  () => undefined,
  () => {
    const first = Behave.useCallback(() => undefined, []);
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
];

export const ContextualArrayModels: Model<undefined, undefined, FirstPort>[] = [
  () => {
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
  () => undefined,
  () => {
    const first = Behave.useCallback(() => undefined, []);
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
];

export const NonPreservingTupleModels = [
  () => {
    const first = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    return undefined;
  },
] satisfies [Model<undefined, undefined, FirstPort>];

type FirstReadonlyTuple = readonly [
  Model<undefined, undefined, FirstPort>,
  Model<undefined, undefined, FirstPort>,
  Model<undefined, undefined, FirstPort>,
];

export const ContextualReadonlyTupleModels: FirstReadonlyTuple = [
  () => {
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
  () => undefined,
  () => {
    const first = Behave.useCallback(() => undefined, []);
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
];

export const ContextualReadonlyArrayModels: ReadonlyArray<
  Model<undefined, undefined, FirstPort>
> = [
  () => {
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
  () => undefined,
  () => {
    const first = Behave.useCallback(() => undefined, []);
    const second = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    Behave.useSignal(secondPort, "second", second);
    return undefined;
  },
];

export const NonPreservingReadonlyTupleModels = [
  () => {
    const first = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    return undefined;
  },
] satisfies readonly [Model<undefined, undefined, FirstPort>];

export const NonPreservingReadonlyArrayModels = [
  () => {
    const first = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    return undefined;
  },
] satisfies ReadonlyArray<Model<undefined, undefined, FirstPort>>;

const ReadonlyCallModels: readonly [Model<undefined, undefined, FirstPort>] = [
  () => {
    const first = Behave.useCallback(() => undefined, []);
    Behave.useSignal(firstPort, "first", first);
    return undefined;
  },
];

Behave.createModel(BuiltInOnly, undefined);
Behave.createModel(UnannotatedProvider, undefined);
Behave.createModel(ImportedUnannotatedProvider, undefined);
Behave.createModel(WrongBody as Model<undefined, undefined, FirstPort>, undefined);
Behave.createModel<undefined, undefined, FirstPort>(WrongBody, undefined);
Behave.createModel(StaticModels.Wrong, undefined);
Behave.createModel(
  ReadonlyCallModels[0] as Model<undefined, undefined, SecondPort>,
  undefined,
);

const SatisfiesProvider = (() => {
  const first = Behave.useCallback(() => undefined, []);
  Behave.useSignal(firstPort, "first", first);
  return undefined;
}) satisfies Model<undefined, undefined, FirstPort>;

const AliasedSatisfiesProvider = (() => {
  const first = Behave.useCallback(() => undefined, []);
  Behave.useSignal(firstPort, "first", first);
  return undefined;
}) satisfies FirstModel;

const OuterInnerMismatch: Model<undefined, undefined, FirstPort> = (() => {
  const first = Behave.useCallback(() => undefined, []);
  Behave.useSignal(firstPort, "first", first);
  return undefined;
}) satisfies Model<undefined, undefined, SecondPort>;

void SatisfiesProvider;
void AliasedSatisfiesProvider;
void OuterInnerMismatch;

export default (() => {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(secondPort, "second", second);
  return undefined;
}) as Model<undefined, undefined, FirstPort>;
