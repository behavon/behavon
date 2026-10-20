import Behave from "behavon";
import type { Model, PortDescriptor, Signal } from "behavon";

interface FirstPort {
  first: Signal;
}

interface SecondPort {
  second: Signal;
}

const firstPort = Behave.createPort<FirstPort>({ first: Behave.SignalType() });
const secondPort = Behave.createPort<SecondPort>({ second: Behave.SignalType() });

function useObjectPort({ port }: { port: PortDescriptor<SecondPort> }): void {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(port, "second", second);
}

function useDefaultPort(port: PortDescriptor<SecondPort> = secondPort): void {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(port, "second", second);
}

function useRestPort(...ports: PortDescriptor<SecondPort>[]): void {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(ports[0], "second", second);
}

function useDirectPort(port: PortDescriptor<SecondPort>): void {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(port, "second", second);
}

const carrier = {
  nested: { port: secondPort },
  list: [secondPort] as const,
};

const ObjectPatternWrong: Model<undefined, undefined, FirstPort> = () => {
  useObjectPort({ port: secondPort });
  return undefined;
};

const DefaultWrong: Model<undefined, undefined, FirstPort> = () => {
  useDefaultPort();
  return undefined;
};

const ExplicitUndefinedDefaultWrong: Model<undefined, undefined, FirstPort> = () => {
  useDefaultPort(undefined);
  return undefined;
};

const RestWrong: Model<undefined, undefined, FirstPort> = () => {
  useRestPort(secondPort);
  return undefined;
};

const NestedMemberWrong: Model<undefined, undefined, FirstPort> = () => {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(carrier.nested.port, "second", second);
  return undefined;
};

const ArrayMemberWrong: Model<undefined, undefined, FirstPort> = () => {
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(carrier.list[0], "second", second);
  return undefined;
};

const NestedDestructureWrong: Model<undefined, undefined, FirstPort> = () => {
  const { nested: { port } } = carrier;
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(port, "second", second);
  return undefined;
};

const CallArgumentWrong: Model<undefined, undefined, FirstPort> = () => {
  useDirectPort(carrier.nested.port);
  return undefined;
};

const MixedCarrier: Model<undefined, undefined, FirstPort> = () => {
  const first = Behave.useCallback(() => undefined, []);
  Behave.useSignal(firstPort, "first", first);
  useDirectPort(carrier.list[0]);
  return undefined;
};

const MemberAfterDestructureWrong: Model<undefined, undefined, FirstPort> = () => {
  const { nested } = carrier;
  const second = Behave.useCallback(() => undefined, []);
  Behave.useSignal(nested.port, "second", second);
  return undefined;
};
