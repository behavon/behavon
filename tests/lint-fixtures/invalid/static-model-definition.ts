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
const firstDeclaration = {
  first: Behave.SignalType<[]>(),
  extra: Behave.SignalType<[]>(),
};
const variablePort = Behave.createPort<FirstPort>(firstDeclaration);
const makePort = Behave.createPort;
const { createPort } = Behave;
const storedPortFactory = { make: Behave.createPort };
const boundPortFactory = Behave.createPort.bind(Behave);

function defaultPortFactory(make = Behave.createPort): typeof make {
  return make;
}

function acceptPortFactory(make: typeof Behave.createPort): typeof make {
  return make;
}

const passedPortFactory = acceptPortFactory(Behave.createPort);

const MissingDescriptor: Model<undefined, undefined, FirstPort> = () => undefined;

const MissingModelPort: Model<undefined, undefined> = () => {
  const first = Behave.useCallback(() => undefined, []);
  Behave.useSignal(firstPort, "first", first);
  return undefined;
};

const WrongDescriptor: Model<undefined, undefined, FirstPort> = () => {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(secondPort, "second", second);
  return undefined;
};

const MixedDescriptors: Model<undefined, undefined, FirstPort> = () => {
  const first = Behave.useCallback(() => undefined, []);
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(firstPort, "first", first);
  Behave.useSignal(secondPort, "second", second);
  return undefined;
};

type FirstPortModel = Model<undefined, undefined, FirstPort>;

const AliasWrongDescriptor: FirstPortModel = () => {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(secondPort, "second", second);
  return undefined;
};

const SatisfiesWrongDescriptor = (() => {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(secondPort, "second", second);
  return undefined;
}) satisfies Model<undefined, undefined, FirstPort>;

const AssertedWrongDescriptor = (() => {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(secondPort, "second", second);
  return undefined;
}) as Model<undefined, undefined, FirstPort>;

void variablePort;
void createPort;
void storedPortFactory;
void boundPortFactory;
void defaultPortFactory;
void passedPortFactory;

function StaticModel(): undefined {
  return undefined;
}

function selectModel() {
  return StaticModel;
}

export function createDynamicModels(): void {
  function NestedModel(): undefined {
    return undefined;
  }

  Behave.createModel(NestedModel, undefined);
  Behave.createModel(() => undefined, undefined);
  Behave.createModel(function ExpressionModel() { return undefined; }, undefined);
  Behave.boundary(StaticModel);
  Behave.createModel(selectModel(), undefined);
  const selected = selectModel();
  Behave.createModel(selected, undefined);
  const models = { NestedModel };
  Behave.createModel(models.NestedModel, undefined);
  Behave.createPort<FirstPort>({ first: Behave.SignalType() });
  makePort<FirstPort>({ first: Behave.SignalType() });
}
