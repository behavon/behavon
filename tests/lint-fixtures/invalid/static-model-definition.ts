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
const firstDeclaration = {
  first: Behavon.SignalType<[]>(),
  extra: Behavon.SignalType<[]>(),
};
const variablePort = Behavon.createPort<FirstPort>(firstDeclaration);
const makePort = Behavon.createPort;
const { createPort } = Behavon;
const storedPortFactory = { make: Behavon.createPort };
const boundPortFactory = Behavon.createPort.bind(Behavon);

function defaultPortFactory(make = Behavon.createPort): typeof make {
  return make;
}

function acceptPortFactory(make: typeof Behavon.createPort): typeof make {
  return make;
}

const passedPortFactory = acceptPortFactory(Behavon.createPort);

const MissingDescriptor: Model<undefined, undefined, FirstPort> = () => undefined;

const MissingModelPort: Model<undefined, undefined> = () => {
  const first = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(firstPort, "first", first);
  return undefined;
};

const WrongDescriptor: Model<undefined, undefined, FirstPort> = () => {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(secondPort, "second", second);
  return undefined;
};

const MixedDescriptors: Model<undefined, undefined, FirstPort> = () => {
  const first = Behavon.useCallback(() => undefined, []);
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(firstPort, "first", first);
  Behavon.useSignal(secondPort, "second", second);
  return undefined;
};

type FirstPortModel = Model<undefined, undefined, FirstPort>;

const AliasWrongDescriptor: FirstPortModel = () => {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(secondPort, "second", second);
  return undefined;
};

const SatisfiesWrongDescriptor = (() => {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(secondPort, "second", second);
  return undefined;
}) satisfies Model<undefined, undefined, FirstPort>;

const AssertedWrongDescriptor = (() => {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(secondPort, "second", second);
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

  Behavon.createModel(NestedModel, undefined);
  Behavon.createModel(() => undefined, undefined);
  Behavon.createModel(function ExpressionModel() { return undefined; }, undefined);
  Behavon.createModel(selectModel(), undefined);
  const selected = selectModel();
  Behavon.createModel(selected, undefined);
  const models = { NestedModel };
  Behavon.createModel(models.NestedModel, undefined);
  Behavon.createPort<FirstPort>({ first: Behavon.SignalType() });
  makePort<FirstPort>({ first: Behavon.SignalType() });
}
