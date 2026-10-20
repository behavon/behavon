import Behavon from "behavon";
import type { Model, PortDescriptor, Signal } from "behavon";

interface FirstPort {
  first: Signal;
}

interface SecondPort {
  second: Signal;
}

const firstPort = Behavon.createPort<FirstPort>({ first: Behavon.SignalType() });
const secondPort = Behavon.createPort<SecondPort>({ second: Behavon.SignalType() });

function useObjectPort({ port }: { port: PortDescriptor<SecondPort> }): void {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(port, "second", second);
}

function useDefaultPort(port: PortDescriptor<SecondPort> = secondPort): void {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(port, "second", second);
}

function useRestPort(...ports: PortDescriptor<SecondPort>[]): void {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(ports[0], "second", second);
}

function useDirectPort(port: PortDescriptor<SecondPort>): void {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(port, "second", second);
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
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(carrier.nested.port, "second", second);
  return undefined;
};

const ArrayMemberWrong: Model<undefined, undefined, FirstPort> = () => {
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(carrier.list[0], "second", second);
  return undefined;
};

const NestedDestructureWrong: Model<undefined, undefined, FirstPort> = () => {
  const { nested: { port } } = carrier;
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(port, "second", second);
  return undefined;
};

const CallArgumentWrong: Model<undefined, undefined, FirstPort> = () => {
  useDirectPort(carrier.nested.port);
  return undefined;
};

const MixedCarrier: Model<undefined, undefined, FirstPort> = () => {
  const first = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(firstPort, "first", first);
  useDirectPort(carrier.list[0]);
  return undefined;
};

const MemberAfterDestructureWrong: Model<undefined, undefined, FirstPort> = () => {
  const { nested } = carrier;
  const second = Behavon.useCallback(() => undefined, []);
  Behavon.useSignal(nested.port, "second", second);
  return undefined;
};
