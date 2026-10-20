import Behavon from "behavon";
import type { Model, Signal } from "behavon";
import { importedPort } from "../support/static-port";

interface FirstPort {
  first: Signal;
}

interface SecondPort {
  second: Signal;
}

type FirstModel = Model<undefined, undefined, FirstPort>;

const firstPort = Behavon.createPort<FirstPort>({ first: Behavon.SignalType() });
const secondPort = Behavon.createPort<SecondPort>({ second: Behavon.SignalType() });

const BuiltInOnly: Model<undefined, readonly [number, () => undefined], FirstPort> = () => {
  const [state] = Behavon.useState(0);
  const callback = Behavon.useCallback(() => undefined, []);
  return [state, callback] as const;
};

function UnannotatedProvider(): undefined {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(secondPort, "second", second);
  return undefined;
}

function WrongBody(): undefined {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(secondPort, "second", second);
  return undefined;
}

function ImportedUnannotatedProvider(): undefined {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(importedPort, "fire", fire);
  return undefined;
}

export function ExportedUninstantiatedProvider(): undefined {
  const first = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(firstPort, "first", first);
  return undefined;
}

const StaticModels = {
  Wrong: (() => {
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  }) satisfies Model<undefined, undefined, FirstPort>,
};

export const ContextualModels: {
  Provider: Model<undefined, undefined, FirstPort>;
} = {
  Provider: () => {
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
};

export const NonPreservingContextualModels = {
  Provider: () => {
    const first = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
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

export const ContextualTupleModels: [
  Model<undefined, undefined, FirstPort>,
  Model<undefined, undefined, FirstPort>,
  Model<undefined, undefined, FirstPort>,
] = [
  () => {
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
  () => undefined,
  () => {
    const first = Behavon.useCallback(() => undefined, []);
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
];

export const ContextualArrayModels: Model<undefined, undefined, FirstPort>[] = [
  () => {
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
  () => undefined,
  () => {
    const first = Behavon.useCallback(() => undefined, []);
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
];

export const NonPreservingTupleModels = [
  () => {
    const first = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
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
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
  () => undefined,
  () => {
    const first = Behavon.useCallback(() => undefined, []);
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
];

export const ContextualReadonlyArrayModels: ReadonlyArray<
  Model<undefined, undefined, FirstPort>
> = [
  () => {
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
  () => undefined,
  () => {
    const first = Behavon.useCallback(() => undefined, []);
    const second = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    Behavon.useSignal(secondPort, "second", second);
    return undefined;
  },
];

export const NonPreservingReadonlyTupleModels = [
  () => {
    const first = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    return undefined;
  },
] satisfies readonly [Model<undefined, undefined, FirstPort>];

export const NonPreservingReadonlyArrayModels = [
  () => {
    const first = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    return undefined;
  },
] satisfies ReadonlyArray<Model<undefined, undefined, FirstPort>>;

const ReadonlyCallModels: readonly [Model<undefined, undefined, FirstPort>] = [
  () => {
    const first = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(firstPort, "first", first);
    return undefined;
  },
];

Behavon.createModel(BuiltInOnly, undefined);
Behavon.createModel(UnannotatedProvider, undefined);
Behavon.createModel(ImportedUnannotatedProvider, undefined);
Behavon.createModel(WrongBody as Model<undefined, undefined, FirstPort>, undefined);
Behavon.createModel<undefined, undefined, FirstPort>(WrongBody, undefined);
Behavon.createModel(StaticModels.Wrong, undefined);
Behavon.createModel(
  ReadonlyCallModels[0] as Model<undefined, undefined, SecondPort>,
  undefined,
);

const SatisfiesProvider = (() => {
  const first = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(firstPort, "first", first);
  return undefined;
}) satisfies Model<undefined, undefined, FirstPort>;

const AliasedSatisfiesProvider = (() => {
  const first = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(firstPort, "first", first);
  return undefined;
}) satisfies FirstModel;

const OuterInnerMismatch: Model<undefined, undefined, FirstPort> = (() => {
  const first = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(firstPort, "first", first);
  return undefined;
}) satisfies Model<undefined, undefined, SecondPort>;

void SatisfiesProvider;
void AliasedSatisfiesProvider;
void OuterInnerMismatch;

export default (() => {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(secondPort, "second", second);
  return undefined;
}) as Model<undefined, undefined, FirstPort>;
