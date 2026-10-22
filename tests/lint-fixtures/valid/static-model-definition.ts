import Behavon from "behavon";
import { createPort, createPort as cp } from "behavon";
import type { Model, PortDescriptor, Signal } from "behavon";
import {
  importedPort,
  importedPort as sameImportedPort,
  useImportedPort,
} from "../support/static-port";
import type { ImportedPort } from "../support/static-port";

interface StaticPort {
  fire: Signal;
}

class UnrelatedFactory {
  createPort(): undefined {
    return undefined;
  }
}

void UnrelatedFactory;

const staticPort = Behavon.createPort<StaticPort>({
  fire: Behavon.SignalType(),
});

function useStaticPort(): void {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(staticPort, "fire", fire);
}

const StaticPortModel: Model<undefined, undefined, StaticPort> = () => {
  useStaticPort();
  return undefined;
};

const staticPortAlias = staticPort;
type StaticPortAlias = StaticPort;
type StaticPortModelAlias = Model<undefined, undefined, StaticPort>;

const AliasPortModel: StaticPortModelAlias = () => {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(staticPortAlias, "fire", fire);
  return undefined;
};

function useProvidedPort(port: PortDescriptor<StaticPort>): void {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(port, "fire", fire);
}

const providedPort = Behavon.createPort<StaticPortAlias>({
  fire: Behavon.SignalType(),
});

const namedPort = createPort<StaticPort>({
  fire: Behavon.SignalType(),
});

const aliasedNamedPort = cp<StaticPort>({
  fire: Behavon.SignalType(),
});

void aliasedNamedPort;

const ParameterPortModel: Model<undefined, undefined, StaticPort> = () => {
  useProvidedPort(providedPort);
  return undefined;
};

const AssertedPortModel = (() => {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(providedPort, "fire", fire);
  return undefined;
}) as Model<undefined, undefined, StaticPortAlias>;

const RedundantSatisfiesModel: Model<undefined, undefined, StaticPort> = (() => {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(staticPort, "fire", fire);
  return undefined;
}) satisfies Model<undefined, undefined, StaticPort>;

const NamedPortModel: Model<undefined, undefined, StaticPort> = () => {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(namedPort, "fire", fire);
  return undefined;
};

const ImportedPortModel: Model<undefined, undefined, ImportedPort> = () => {
  const fire = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(importedPort, "fire", fire);
  const reset = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(sameImportedPort, "reset", reset);
  return undefined;
};

const OpaqueImportedHookModel: Model<undefined, undefined, StaticPort> = () => {
  useStaticPort();
  useImportedPort(importedPort);
  return undefined;
};

function StaticModel(): undefined {
  return undefined;
}

const StaticModels = { Nested: StaticModel };

export const ContextualPortModels: {
  Property: Model<undefined, undefined, StaticPort>;
  Method: Model<undefined, undefined, StaticPort>;
} = {
  Property: () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
  Method() {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
};

export const PreservingContextualSatisfies: {
  Provider: Model<undefined, undefined, StaticPort>;
} = ({
  Provider: () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
}) satisfies {
  Provider: Model<undefined, undefined, StaticPort>;
};

interface ContextualPortModelInterface {
  Property: Model<undefined, undefined, StaticPort>;
  Method: Model<undefined, undefined, StaticPort>;
}

export const InterfaceContextualPortModels: ContextualPortModelInterface = {
  Property: () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
  Method() {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
};

interface BaseComposedPortModels {
  Provider: Model<undefined, undefined, StaticPort>;
}

interface ExtendedComposedPortModels extends BaseComposedPortModels {}
type IntersectedComposedPortModels = BaseComposedPortModels & {};

export const ExtendedContextualPortModels: ExtendedComposedPortModels = {
  Provider: () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
};

export const IntersectedContextualPortModels: IntersectedComposedPortModels = {
  Provider: () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
};

export const ContextualPortTuple: [
  Model<undefined, undefined, StaticPort>,
] = [
  () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
];

export const ContextualPortArray: Model<undefined, undefined, StaticPort>[] = [
  () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
];

type StaticReadonlyPortTuple = readonly [
  Model<undefined, undefined, StaticPort>,
];

export const ContextualReadonlyPortTuple: StaticReadonlyPortTuple = [
  () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
];

export const ContextualReadonlyPortArray: ReadonlyArray<
  Model<undefined, undefined, StaticPort>
> = [
  () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
];

export const PreservingReadonlyPortTuple: StaticReadonlyPortTuple = ([
  () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
]) satisfies StaticReadonlyPortTuple;

export const PreservingReadonlyPortArray: ReadonlyArray<
  Model<undefined, undefined, StaticPort>
> = ([
  () => {
    const fire = Behavon.useCallback(() => undefined, []);
    Behavon.useSignal(staticPort, "fire", fire);
    return undefined;
  },
]) satisfies ReadonlyArray<Model<undefined, undefined, StaticPort>>;

export function createStaticModels(): void {
  const direct = Behavon.createModel(StaticModel, undefined);
  const member = Behavon.createModel(StaticModels.Nested, undefined);
  const contextualProperty = Behavon.createModel(ContextualPortModels.Property, undefined);
  const contextualMethod = Behavon.createModel(ContextualPortModels.Method, undefined);
  const preservingContextual = Behavon.createModel(
    PreservingContextualSatisfies.Provider,
    undefined,
  );
  const interfaceProperty = Behavon.createModel(
    InterfaceContextualPortModels.Property,
    undefined,
  );
  const interfaceMethod = Behavon.createModel(
    InterfaceContextualPortModels.Method,
    undefined,
  );
  const extendedProperty = Behavon.createModel(
    ExtendedContextualPortModels.Provider,
    undefined,
  );
  const intersectedProperty = Behavon.createModel(
    IntersectedContextualPortModels.Provider,
    undefined,
  );
  const tupleModel = Behavon.createModel(ContextualPortTuple[0], undefined);
  const arrayModel = Behavon.createModel(ContextualPortArray[0], undefined);
  const readonlyTupleModel = Behavon.createModel(ContextualReadonlyPortTuple[0], undefined);
  const readonlyArrayModel = Behavon.createModel(ContextualReadonlyPortArray[0], undefined);
  const preservingReadonlyTuple = Behavon.createModel(PreservingReadonlyPortTuple[0], undefined);
  const preservingReadonlyArray = Behavon.createModel(PreservingReadonlyPortArray[0], undefined);
  const port = Behavon.createModel(StaticPortModel, undefined);
  const aliasPort = Behavon.createModel(AliasPortModel, undefined);
  const parameterPort = Behavon.createModel(ParameterPortModel, undefined);
  const assertedPort = Behavon.createModel(AssertedPortModel, undefined);
  const redundantSatisfies = Behavon.createModel(RedundantSatisfiesModel, undefined);
  const namedPortInstance = Behavon.createModel(NamedPortModel, undefined);
  const imported = Behavon.createModel(ImportedPortModel, undefined);
  const opaqueImportedHook = Behavon.createModel(OpaqueImportedHookModel, undefined);
  direct.dispose();
  member.dispose();
  contextualProperty.dispose();
  contextualMethod.dispose();
  preservingContextual.dispose();
  interfaceProperty.dispose();
  interfaceMethod.dispose();
  extendedProperty.dispose();
  intersectedProperty.dispose();
  tupleModel.dispose();
  arrayModel.dispose();
  readonlyTupleModel.dispose();
  readonlyArrayModel.dispose();
  preservingReadonlyTuple.dispose();
  preservingReadonlyArray.dispose();
  port.dispose();
  aliasPort.dispose();
  parameterPort.dispose();
  assertedPort.dispose();
  redundantSatisfies.dispose();
  namedPortInstance.dispose();
  imported.dispose();
  opaqueImportedHook.dispose();
}
