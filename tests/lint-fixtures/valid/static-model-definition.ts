import Behave from "behavon";
import { createPort, createPort as cp } from "behavon";
import type { BoundaryState, Model, PortDescriptor, Signal } from "behavon";
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

const staticPort = Behave.createPort<StaticPort>({
  fire: Behave.SignalType(),
});

function useStaticPort(): void {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(staticPort, "fire", fire);
}

const StaticPortModel: Model<undefined, undefined, StaticPort> = () => {
  useStaticPort();
  return undefined;
};

const staticPortAlias = staticPort;
type StaticPortAlias = StaticPort;
type StaticPortModelAlias = Model<undefined, undefined, StaticPort>;

const AliasPortModel: StaticPortModelAlias = () => {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(staticPortAlias, "fire", fire);
  return undefined;
};

function useProvidedPort(port: PortDescriptor<StaticPort>): void {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(port, "fire", fire);
}

const providedPort = Behave.createPort<StaticPortAlias>({
  fire: Behave.SignalType(),
});

const namedPort = createPort<StaticPort>({
  fire: Behave.SignalType(),
});

const aliasedNamedPort = cp<StaticPort>({
  fire: Behave.SignalType(),
});

void aliasedNamedPort;

const ParameterPortModel: Model<undefined, undefined, StaticPort> = () => {
  useProvidedPort(providedPort);
  return undefined;
};

const AssertedPortModel = (() => {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(providedPort, "fire", fire);
  return undefined;
}) as Model<undefined, undefined, StaticPortAlias>;

const RedundantSatisfiesModel: Model<undefined, undefined, StaticPort> = (() => {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(staticPort, "fire", fire);
  return undefined;
}) satisfies Model<undefined, undefined, StaticPort>;

const NamedPortModel: Model<undefined, undefined, StaticPort> = () => {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(namedPort, "fire", fire);
  return undefined;
};

const ImportedPortModel: Model<undefined, undefined, ImportedPort> = () => {
  const fire = Behave.useCallback(() => undefined, []);
  Behave.useSignal(importedPort, "fire", fire);
  const reset = Behave.useCallback(() => undefined, []);
  Behave.useSignal(sameImportedPort, "reset", reset);
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

function SchemaLessModel(): undefined {
  const legacy = Behave.useCallback(() => undefined, []);
  Behave.useSignal("legacy", legacy);
  return undefined;
}

const StaticBoundaryModel = Behave.boundary(StaticModel);
const StaticModels = { Nested: StaticModel };

export const ContextualPortModels: {
  Property: Model<undefined, undefined, StaticPort>;
  Method: Model<undefined, undefined, StaticPort>;
} = {
  Property: () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
  Method() {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
};

export const PreservingContextualSatisfies: {
  Provider: Model<undefined, undefined, StaticPort>;
} = ({
  Provider: () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
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
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
  Method() {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
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
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
};

export const IntersectedContextualPortModels: IntersectedComposedPortModels = {
  Provider: () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
};

export const ContextualPortTuple: [
  Model<undefined, undefined, StaticPort>,
] = [
  () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
];

export const ContextualPortArray: Model<undefined, undefined, StaticPort>[] = [
  () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
];

type StaticReadonlyPortTuple = readonly [
  Model<undefined, undefined, StaticPort>,
];

export const ContextualReadonlyPortTuple: StaticReadonlyPortTuple = [
  () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
];

export const ContextualReadonlyPortArray: ReadonlyArray<
  Model<undefined, undefined, StaticPort>
> = [
  () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
];

export const PreservingReadonlyPortTuple: StaticReadonlyPortTuple = ([
  () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
]) satisfies StaticReadonlyPortTuple;

export const PreservingReadonlyPortArray: ReadonlyArray<
  Model<undefined, undefined, StaticPort>
> = ([
  () => {
    const fire = Behave.useCallback(() => undefined, []);
    Behave.useSignal(staticPort, "fire", fire);
    return undefined;
  },
]) satisfies ReadonlyArray<Model<undefined, undefined, StaticPort>>;

export function createStaticModels(): void {
  const direct = Behave.createModel(StaticModel, undefined);
  const schemaLess = Behave.createModel(SchemaLessModel, undefined);
  const bounded = Behave.createModel(StaticBoundaryModel, undefined);
  const member = Behave.createModel(StaticModels.Nested, undefined);
  const contextualProperty = Behave.createModel(ContextualPortModels.Property, undefined);
  const contextualMethod = Behave.createModel(ContextualPortModels.Method, undefined);
  const preservingContextual = Behave.createModel(
    PreservingContextualSatisfies.Provider,
    undefined,
  );
  const interfaceProperty = Behave.createModel(
    InterfaceContextualPortModels.Property,
    undefined,
  );
  const interfaceMethod = Behave.createModel(
    InterfaceContextualPortModels.Method,
    undefined,
  );
  const extendedProperty = Behave.createModel(
    ExtendedContextualPortModels.Provider,
    undefined,
  );
  const intersectedProperty = Behave.createModel(
    IntersectedContextualPortModels.Provider,
    undefined,
  );
  const tupleModel = Behave.createModel(ContextualPortTuple[0], undefined);
  const arrayModel = Behave.createModel(ContextualPortArray[0], undefined);
  const readonlyTupleModel = Behave.createModel(ContextualReadonlyPortTuple[0], undefined);
  const readonlyArrayModel = Behave.createModel(ContextualReadonlyPortArray[0], undefined);
  const preservingReadonlyTuple = Behave.createModel(PreservingReadonlyPortTuple[0], undefined);
  const preservingReadonlyArray = Behave.createModel(PreservingReadonlyPortArray[0], undefined);
  const port = Behave.createModel(StaticPortModel, undefined);
  const aliasPort = Behave.createModel(AliasPortModel, undefined);
  const parameterPort = Behave.createModel(ParameterPortModel, undefined);
  const assertedPort = Behave.createModel(AssertedPortModel, undefined);
  const redundantSatisfies = Behave.createModel(RedundantSatisfiesModel, undefined);
  const namedPortInstance = Behave.createModel(NamedPortModel, undefined);
  const imported = Behave.createModel(ImportedPortModel, undefined);
  const opaqueImportedHook = Behave.createModel(OpaqueImportedHookModel, undefined);
  direct.dispose();
  schemaLess.dispose();
  bounded.dispose();
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

const StaticPortBoundary = Behave.boundary(StaticPortModel);
type SchemaLessBoundaryModel = Model<undefined, BoundaryState<undefined>>;

const StaticPortBoundaryAlias: SchemaLessBoundaryModel = StaticPortBoundary;
const StaticPortBoundaryObject: { Outer: SchemaLessBoundaryModel } = {
  Outer: Behave.boundary(StaticPortModel),
};
const StaticPortBoundaryTuple: readonly [SchemaLessBoundaryModel] = [
  Behave.boundary(StaticPortModel),
];

export function createStaticPortBoundary(): void {
  const boundary = Behave.createModel(StaticPortBoundary, undefined);
  const alias = Behave.createModel(StaticPortBoundaryAlias, undefined);
  const object = Behave.createModel(StaticPortBoundaryObject.Outer, undefined);
  const tuple = Behave.createModel(StaticPortBoundaryTuple[0], undefined);
  boundary.dispose();
  alias.dispose();
  object.dispose();
  tuple.dispose();
}

export default Behave.boundary(StaticPortModel) as SchemaLessBoundaryModel;
