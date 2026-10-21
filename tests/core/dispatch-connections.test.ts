import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
import { describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import type { ConnectionMeta, Signal, Slot, TypedModelRef } from "behavon";
import { waitFor, signalOf } from "../helpers";

function captureUnhandledRejection(trigger: () => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      process.off("unhandledRejection", onUnhandledRejection);
      reject(new Error("Expected an unhandled rejection"));
    }, 1_000);
    const onUnhandledRejection = (reason: unknown): void => {
      setImmediate(() => {
        clearTimeout(timeout);
        process.off("unhandledRejection", onUnhandledRejection);
        resolve(reason);
      });
    };

    process.on("unhandledRejection", onUnhandledRejection);
    try {
      trigger();
    } catch (error: unknown) {
      clearTimeout(timeout);
      process.off("unhandledRejection", onUnhandledRejection);
      reject(error);
    }
  });
}

interface ProducerEndpoints {
  readonly fire: Signal<readonly [value: number]>;
}

interface ConsumerEndpoints {
  readonly receive: Slot<readonly [value: number]>;
}

interface ArbitraryPayloadSourceEndpoints {
  readonly fire: Signal<readonly unknown[]>;
}

interface ArbitraryPayloadDestinationEndpoints {
  readonly receive: Slot<readonly unknown[]>;
}

function createSlotObservationHarness(mode: "direct" | "connected"): {
  readonly root: Readonly<{ dispose(): void }>;
  readonly invoke: () => undefined;
  readonly setResult: (result: unknown) => void;
  readonly siblingSlotCalls: () => number;
  readonly laterConnectionCalls: () => number;
} {
  interface SourceEndpoints {
    readonly fire: Signal;
  }
  interface DestinationEndpoints {
    readonly receive: Slot;
  }
  let nextResult: unknown;
  let direct: Slot | undefined;
  let signal: Signal | undefined;
  let siblingCalls = 0;
  let laterCalls = 0;

  type SourcePortType = { "fire": PortOnlySignal<any> };
  const sourcePort = Behavon.createPort<SourcePortType>({ "fire": Behavon.SignalType() });
  function Source(): undefined {
    const fireBody = Behavon.useCallback(() => undefined, []);
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    signal = Behavon.useSignal(sourcePort, "fire", fireBody);
    Behavon.useExport(sourcePort, "fire");
    return undefined;
  }

  type FirstDestinationPortType = { "receive": PortOnlySlot<any> };
  const firstDestinationPort = Behavon.createPort<FirstDestinationPortType>({ "receive": Behavon.SlotType() });
  function FirstDestination(): undefined {
    const observedBody = Behavon.useCallback((): unknown => nextResult, []);
    const siblingBody = Behavon.useCallback(() => {
      siblingCalls += 1;
    }, []);
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    direct = Behavon.useSlot(firstDestinationPort, "receive", observedBody);
    Behavon.useSlot(firstDestinationPort, "receive", siblingBody);
    return undefined;
  }

  type LaterDestinationPortType = { "receive": PortOnlySlot<any> };
  const laterDestinationPort = Behavon.createPort<LaterDestinationPortType>({ "receive": Behavon.SlotType() });
  function LaterDestination(): undefined {
    const receiveBody = Behavon.useCallback(() => {
      laterCalls += 1;
    }, []);
    Behavon.useSlot(laterDestinationPort, "receive", receiveBody);
    return undefined;
  }

  const source = mode === "connected" ? Behavon.createModel((Source as unknown as Model<any, any, SourcePortType>), undefined) : undefined;
  const first = mode === "connected" ? Behavon.createModel((FirstDestination as unknown as Model<any, any, FirstDestinationPortType>), undefined) : undefined;
  const later = mode === "connected" ? Behavon.createModel((LaterDestination as unknown as Model<any, any, LaterDestinationPortType>), undefined) : undefined;
  function ConnectedApp(): undefined {
    if (source === undefined || first === undefined || later === undefined) {
      throw new Error("connected roots must be assembled before the connection owner");
    }
    const firstDestination = Behavon.usePort(first);
    const laterDestination = Behavon.usePort(later);
    const fire = signalOf(source, "fire");
    Behavon.useConnect(fire, firstDestination.receive);
    Behavon.useConnect(fire, laterDestination.receive);
    return undefined;
  }

  const connectionOwner = mode === "direct"
    ? Behavon.createModel((FirstDestination as unknown as Model<any, any, FirstDestinationPortType>), undefined)
    : Behavon.createModel(ConnectedApp, undefined);
  const endpoint = mode === "direct" ? direct : signal;
  if (endpoint === undefined) throw new Error("slot observation endpoint must be available");
  return {
    root: {
      dispose(): void {
        connectionOwner.dispose();
        later?.dispose();
        first?.dispose();
        source?.dispose();
      },
    },
    invoke: endpoint,
    setResult(result: unknown): void {
      nextResult = result;
    },
    siblingSlotCalls: () => siblingCalls,
    laterConnectionCalls: () => laterCalls,
  };
}

function createArbitraryPayloadHarness(): {
  readonly root: Readonly<{ dispose(): void }>;
  readonly signal: Signal<readonly unknown[]>;
  readonly directSlot: Slot<readonly unknown[]>;
  readonly signalBodies: unknown[][];
  readonly slotBodies: unknown[][];
  readonly runtimeMeta: ConnectionMeta;
} {
  const signalBodies: unknown[][] = [];
  const slotBodies: unknown[][] = [];
  let signal: Signal<readonly unknown[]> | undefined;
  let directSlot: Slot<readonly unknown[]> | undefined;

  type SourcePort1Type = { "fire": PortOnlySignal<any> };
  const sourcePort1 = Behavon.createPort<SourcePort1Type>({ "fire": Behavon.SignalType() });
  function Source(): undefined {
    const fireBody = Behavon.useCallback((...args: readonly unknown[]) => {
      signalBodies.push([...args]);
    }, []);
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    signal = Behavon.useSignal(sourcePort1, "fire", fireBody);
    Behavon.useExport(sourcePort1, "fire");
    return undefined;
  }

  type DestinationPortType = { "receive": PortOnlySlot<any> };
  const destinationPort = Behavon.createPort<DestinationPortType>({ "receive": Behavon.SlotType() });
  function Destination(): undefined {
    const receiveBody = Behavon.useCallback((...args: readonly unknown[]) => {
      slotBodies.push([...args]);
    }, []);
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    directSlot = Behavon.useSlot(destinationPort, "receive", receiveBody);
    return undefined;
  }

  const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort1Type>), undefined);
  const destination = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPortType>), undefined);
  function App(): undefined {
    const consumer = Behavon.usePort(destination);
    Behavon.useConnect(signalOf(source, "fire"), consumer.receive);
    return undefined;
  }

  const connectionOwner = Behavon.createModel(App, undefined);
  if (signal === undefined || directSlot === undefined) throw new Error("payload harness endpoints must be available");
  signal("capture-meta");
  const runtimeMeta = slotBodies[0]?.[1] as ConnectionMeta | undefined;
  if (runtimeMeta === undefined) throw new Error("payload harness must capture connection metadata");
  signalBodies.length = 0;
  slotBodies.length = 0;
  return {
    root: {
      dispose(): void {
        connectionOwner.dispose();
        destination.dispose();
        source.dispose();
      },
    },
    signal,
    directSlot,
    signalBodies,
    slotBodies,
    runtimeMeta,
  };
}

describe("named dispatchers and connections", () => {
  it("normalizes receiver to undefined at Signal body, direct Slot, and connected Slot boundaries", () => {
    interface Endpoints {
      readonly fire: Signal<readonly [value: string]>;
    }
    const signalReceivers: unknown[] = [];
    const slotReceivers: unknown[] = [];
    let directSlot: Slot<readonly [value: string]> | undefined;

    type ModelPortType = { "fire": PortOnlySignal<any>; "receive": PortOnlySlot<any> };
    const modelPort = Behavon.createPort<ModelPortType>({ "fire": Behavon.SignalType(), "receive": Behavon.SlotType() });
    function Model(): undefined {
      const signalBody = Behavon.useCallback(function (this: void, _value: string) {
        signalReceivers.push(this);
      }, []);
      const slotBody = Behavon.useCallback(function (this: void, _value: string) {
        slotReceivers.push(this);
      }, []);
      const fire = Behavon.useSignal(modelPort, "fire", signalBody);
      Behavon.useExport(modelPort, "fire");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      const receive = directSlot = Behavon.useSlot(modelPort, "receive", slotBody);
      Behavon.useConnect(fire, receive);
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPortType>), undefined);
    try {
      signalOf(root, "fire")("connected");
      if (directSlot === undefined) throw new Error("direct Slot must be created synchronously");
      directSlot("direct");

      expect(signalReceivers).toEqual([undefined]);
      expect(slotReceivers).toEqual([undefined, undefined]);
    } finally {
      root.dispose();
    }
  });

  it("runs explicit Signal bodies in registration order and never emits from a callback call", () => {
    const trace: string[] = [];
    const metadata: ConnectionMeta[] = [];
    let localFirst: ((value: number) => string) | undefined;

    type ProducerPortType = { "fire": PortOnlySignal<any> };
    const producerPort = Behavon.createPort<ProducerPortType>({ "fire": Behavon.SignalType() });
    function Producer(): undefined {
      const first = Behavon.useCallback((value: number) => {
        trace.push(`P1:${value}`);
        return "first";
      }, []);
      const second = Behavon.useCallback((value: number) => {
        trace.push(`P2:${value}`);
        return "second";
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      localFirst = first;
      Behavon.useSignal(producerPort, "fire", first);
      Behavon.useSignal(producerPort, "fire", second);
      Behavon.useExport(producerPort, "fire");
      return undefined;
    }

    type ConsumerPortType = { "receive": PortOnlySlot<any> };
    const consumerPort = Behavon.createPort<ConsumerPortType>({ "receive": Behavon.SlotType() });
    function Consumer(): undefined {
      const first = Behavon.useCallback((value: number, meta?: ConnectionMeta) => {
        trace.push(`S1:${value}`);
        if (meta !== undefined) metadata.push(meta);
      }, []);
      const second = Behavon.useCallback((value: number) => trace.push(`S2:${value}`), []);
      Behavon.useSlot(consumerPort, "receive", first);
      Behavon.useSlot(consumerPort, "receive", second);
      return undefined;
    }

    const producerRef = Behavon.createModel((Producer as unknown as Model<any, any, ProducerPortType>), undefined);
    const consumerRef = Behavon.createModel((Consumer as unknown as Model<any, any, ConsumerPortType>), undefined);
    function App(): undefined {
      const producer = producerRef;
      const consumer = consumerRef;
      const destination = Behavon.usePort(consumer);
      Behavon.useConnect(signalOf(producer, "fire"), destination.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    expect(signalOf(producerRef, "fire")(3)).toBeUndefined();
    expect(trace).toEqual(["P1:3", "P2:3", "S1:3", "S2:3"]);
    expect(metadata).toHaveLength(1);
    expect(metadata[0]).toMatchObject({
      source: producerRef,
      signal: "fire",
      destination: consumerRef,
      slot: "receive",
    });
    expect(typeof metadata[0].connection).toBe("object");
    expect(metadata[0].connection).not.toHaveProperty("disconnect");

    trace.length = 0;
    expect(localFirst?.(4)).toBe("first");
    expect(trace).toEqual(["P1:4"]);
    root.dispose();
    consumerRef.dispose();
    producerRef.dispose();
  });

  it("stops on the first synchronous Signal body error before fan-out", () => {
    const trace: string[] = [];
    const failure = new Error("body failed");

    type ProducerPort1Type = { "fire": PortOnlySignal<any> };
    const producerPort1 = Behavon.createPort<ProducerPort1Type>({ "fire": Behavon.SignalType() });
    function Producer(): undefined {
      const first = Behavon.useCallback((value: number) => trace.push(`P1:${value}`), []);
      const second = Behavon.useCallback(() => {
        trace.push("P2");
        throw failure;
      }, []);
      Behavon.useSignal(producerPort1, "fire", first);
      Behavon.useSignal(producerPort1, "fire", second);
      Behavon.useExport(producerPort1, "fire");
      return undefined;
    }

    type ConsumerPort1Type = { "receive": PortOnlySlot<any> };
    const consumerPort1 = Behavon.createPort<ConsumerPort1Type>({ "receive": Behavon.SlotType() });
    function Consumer(): undefined {
      const receive = Behavon.useCallback(() => trace.push("S"), []);
      Behavon.useSlot(consumerPort1, "receive", receive);
      return undefined;
    }

    const producerRef = Behavon.createModel((Producer as unknown as Model<any, any, ProducerPort1Type>), undefined);
    const consumerRef = Behavon.createModel((Consumer as unknown as Model<any, any, ConsumerPort1Type>), undefined);
    function App(): undefined {
      const producer = producerRef;
      const consumer = consumerRef;
      const consumerDependency = Behavon.usePort(consumer);
      Behavon.useConnect(signalOf(producer, "fire"), consumerDependency.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    expect(() => signalOf(producerRef, "fire")(1)).toThrow(failure);
    expect(trace).toEqual(["P1:1", "P2"]);
    root.dispose();
    consumerRef.dispose();
    producerRef.dispose();
  });

  it("replaces trailing connection metadata at each Signal-Slot hop", () => {
    interface RelayEndpoints {
      readonly relay: Signal<readonly [value: number]> & Slot<readonly [value: number]>;
    }

    interface SinkEndpoints {
      readonly receive: Slot<readonly [value: number]>;
    }

    const relayArguments: unknown[][] = [];
    const sinkArguments: unknown[][] = [];

    type SourcePort2Type = { "fire": PortOnlySignal<any> };
    const sourcePort2 = Behavon.createPort<SourcePort2Type>({ "fire": Behavon.SignalType() });
    function Source(): undefined {
      const fireBody = Behavon.useCallback((_value: number) => undefined, []);
      Behavon.useSignal(sourcePort2, "fire", fireBody);
      Behavon.useExport(sourcePort2, "fire");
      return undefined;
    }

    interface RelayPort {
      readonly relayIn: PortOnlySlot<any>;
      readonly relayOut: PortOnlySignal<any>;
    }
    const relayPort = Behavon.createPort<RelayPort>({ relayIn: Behavon.SlotType(), relayOut: Behavon.SignalType() });
    const Relay: Model<undefined, undefined, RelayPort> = () => {
      const relaySignalBody = Behavon.useCallback((_value: number) => undefined, []);
      const relaySignal = Behavon.useSignal(relayPort, "relayOut", relaySignalBody);
      Behavon.useExport(relayPort, "relayOut");
      const relay = Behavon.useCallback((...args: readonly unknown[]) => {
        relayArguments.push([...args]);
        relaySignal(args[0] as number);
      }, [relaySignal]);
      Behavon.useSlot(relayPort, "relayIn", relay);
      return undefined;
    };

    type SinkPortType = { "receive": PortOnlySlot<any> };
    const sinkPort = Behavon.createPort<SinkPortType>({ "receive": Behavon.SlotType() });
    function Sink(): undefined {
      const receive = Behavon.useCallback((...args: readonly unknown[]) => {
        sinkArguments.push([...args]);
      }, []);
      Behavon.useSlot(sinkPort, "receive", receive);
      return undefined;
    }

    const sourceRef = Behavon.createModel((Source as unknown as Model<any, any, SourcePort2Type>), undefined);
    const relayRef = Behavon.createModel(Relay, undefined);
    const sinkRef = Behavon.createModel((Sink as unknown as Model<any, any, SinkPortType>), undefined);
    function App(): undefined {
      const source = sourceRef;
      const relay = relayRef;
      const sink = sinkRef;
      const relayDependency = Behavon.usePort(relay);
      const sinkDependency = Behavon.usePort(sink);
      Behavon.useConnect(signalOf(source, "fire"), relayDependency.relayIn);
      Behavon.useConnect(signalOf(relay, "relayOut"), sinkDependency.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    signalOf(sourceRef, "fire")(9);
    expect(relayArguments).toHaveLength(1);
    expect(sinkArguments).toHaveLength(1);
    expect(relayArguments[0]).toHaveLength(2);
    expect(sinkArguments[0]).toHaveLength(2);
    expect(relayArguments[0][0]).toBe(9);
    expect(sinkArguments[0][0]).toBe(9);
    expect(sinkArguments[0][1]).not.toBe(relayArguments[0][1]);
    root.dispose();
    sinkRef.dispose();
    relayRef.dispose();
    sourceRef.dispose();
  });

  it("preserves Proxy payload identity without consulting its object protocol", () => {
    const harness = createArbitraryPayloadHarness();
    const protocolCalls: PropertyKey[] = [];
    const payload = new Proxy({ value: 1 }, {
      has(_target, property) {
        protocolCalls.push(property);
        return true;
      },
      get(target, property, receiver) {
        protocolCalls.push(property);
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        protocolCalls.push(property);
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });

    harness.signal(payload);
    harness.directSlot(payload);

    expect(protocolCalls).toEqual([]);
    expect(harness.signalBodies).toHaveLength(1);
    expect(harness.signalBodies[0]).toHaveLength(1);
    expect(harness.signalBodies[0]?.[0]).toBe(payload);
    expect(harness.slotBodies).toHaveLength(2);
    expect(harness.slotBodies[0]?.[0]).toBe(payload);
    expect(harness.slotBodies[0]).toHaveLength(2);
    expect(harness.slotBodies[1]?.[0]).toBe(payload);
    expect(harness.slotBodies[1]).toHaveLength(2);
    expect(protocolCalls).toEqual([]);
    harness.root.dispose();
  });

  it("delivers throwing and revoked Proxy payloads without property access", () => {
    const harness = createArbitraryPayloadHarness();
    const protocolFailure = new Error("payload protocol must not run");
    const throwingPayload = new Proxy({}, {
      has() {
        throw protocolFailure;
      },
      get() {
        throw protocolFailure;
      },
      getOwnPropertyDescriptor() {
        throw protocolFailure;
      },
    });
    const revocable = Proxy.revocable({}, {});
    const revokedPayload = revocable.proxy;
    revocable.revoke();

    expect(() => harness.signal(throwingPayload, revokedPayload)).not.toThrow();
    expect(() => harness.directSlot(throwingPayload, revokedPayload)).not.toThrow();
    expect(harness.signalBodies[0]?.[0]).toBe(throwingPayload);
    expect(harness.signalBodies[0]?.[1]).toBe(revokedPayload);
    expect(harness.slotBodies[0]?.[0]).toBe(throwingPayload);
    expect(harness.slotBodies[0]?.[1]).toBe(revokedPayload);
    expect(harness.slotBodies[0]).toHaveLength(3);
    expect(harness.slotBodies[1]?.[0]).toBe(throwingPayload);
    expect(harness.slotBodies[1]?.[1]).toBe(revokedPayload);
    expect(harness.slotBodies[1]).toHaveLength(3);
    harness.root.dispose();
  });

  it("does not treat ConnectionMeta-shaped, inherited, copied, or wrapped objects as runtime metadata", () => {
    const harness = createArbitraryPayloadHarness();
    const shapeSpoof: ConnectionMeta = {
      source: harness.runtimeMeta.source,
      signal: harness.runtimeMeta.signal,
      destination: harness.runtimeMeta.destination,
      slot: harness.runtimeMeta.slot,
      connection: harness.runtimeMeta.connection,
    };
    const inherited = Object.create(harness.runtimeMeta) as ConnectionMeta;
    const reflectedCopy = Object.defineProperties(
      {},
      Object.getOwnPropertyDescriptors(harness.runtimeMeta),
    ) as ConnectionMeta;
    const functionPayload = () => "payload";
    let wrappedProtocolCalls = 0;
    const wrapped = new Proxy(harness.runtimeMeta, {
      has() {
        wrappedProtocolCalls += 1;
        throw new Error("wrapped metadata protocol must not run");
      },
      get() {
        wrappedProtocolCalls += 1;
        throw new Error("wrapped metadata protocol must not run");
      },
      getOwnPropertyDescriptor() {
        wrappedProtocolCalls += 1;
        throw new Error("wrapped metadata protocol must not run");
      },
    });

    for (const payload of [shapeSpoof, inherited, reflectedCopy, wrapped, functionPayload]) {
      harness.signal(payload);
      const connectedArgs = harness.slotBodies.at(-1);
      expect(connectedArgs?.[0]).toBe(payload);
      expect(connectedArgs).toHaveLength(2);
      harness.directSlot(payload);
      const directArgs = harness.slotBodies.at(-1);
      expect(directArgs?.[0]).toBe(payload);
      expect(directArgs).toHaveLength(2);
    }

    expect(wrappedProtocolCalls).toBe(0);
    expect(Reflect.ownKeys(harness.runtimeMeta).sort()).toEqual([
      "connection",
      "destination",
      "signal",
      "slot",
      "source",
    ]);
    harness.root.dispose();
  });

  it("removes only an exact trailing runtime meta and preserves the same object elsewhere", () => {
    const harness = createArbitraryPayloadHarness();

    harness.signal("connected", harness.runtimeMeta);
    expect(harness.signalBodies[0]).toEqual(["connected", harness.runtimeMeta]);
    expect(harness.slotBodies[0]?.[0]).toBe("connected");
    expect(harness.slotBodies[0]).toHaveLength(2);
    expect(harness.slotBodies[0]?.[1]).not.toBe(harness.runtimeMeta);

    harness.directSlot("direct", harness.runtimeMeta);
    expect(harness.slotBodies[1]?.[0]).toBe("direct");
    expect(harness.slotBodies[1]).toHaveLength(2);
    expect(harness.slotBodies[1]?.[1]).not.toBe(harness.runtimeMeta);

    harness.signal(harness.runtimeMeta, "connected-tail");
    expect(harness.slotBodies[2]?.slice(0, 2)).toEqual([harness.runtimeMeta, "connected-tail"]);
    expect(harness.slotBodies[2]).toHaveLength(3);
    harness.directSlot(harness.runtimeMeta, "direct-tail");
    expect(harness.slotBodies[3]?.slice(0, 2)).toEqual([harness.runtimeMeta, "direct-tail"]);
    expect(harness.slotBodies[3]).toHaveLength(3);

    harness.directSlot("capture-virtual");
    const virtualMeta = harness.slotBodies[4]?.[1] as ConnectionMeta | undefined;
    expect(virtualMeta).toBeDefined();
    harness.signal("connected-virtual", virtualMeta);
    expect(harness.slotBodies[5]?.[0]).toBe("connected-virtual");
    expect(harness.slotBodies[5]).toHaveLength(2);
    expect(harness.slotBodies[5]?.[1]).not.toBe(virtualMeta);
    harness.directSlot("direct-virtual", virtualMeta);
    expect(harness.slotBodies[6]?.[0]).toBe("direct-virtual");
    expect(harness.slotBodies[6]).toHaveLength(2);
    expect(harness.slotBodies[6]?.[1]).not.toBe(virtualMeta);
    harness.root.dispose();
  });

  it("replaces spread inbound metadata for Signal and direct-Slot relays", () => {
    interface RelaySourceEndpoints {
      readonly fire: Signal<readonly unknown[]>;
    }
    interface RelayEndpoints {
      readonly ingress: Slot<readonly unknown[]>;
      readonly relay: Signal<readonly unknown[]>;
    }
    interface RelaySinkEndpoints {
      readonly receive: Slot<readonly unknown[]>;
    }

    const ingressCalls: unknown[][] = [];
    const relaySignalBodies: unknown[][] = [];
    const connectedSinkCalls: unknown[][] = [];
    const directSinkCalls: unknown[][] = [];
    let fire: Signal<readonly unknown[]> | undefined;

    type SourcePort3Type = { "fire": PortOnlySignal<any> };
    const sourcePort3 = Behavon.createPort<SourcePort3Type>({ "fire": Behavon.SignalType() });
    function Source(): undefined {
      const fireBody = Behavon.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire = Behavon.useSignal(sourcePort3, "fire", fireBody);
      Behavon.useExport(sourcePort3, "fire");
      return undefined;
    }

    type RelayPortType = { "relay": PortOnlySignal<any>; "directSink": PortOnlySlot<any>; "ingress": PortOnlySlot<any> };
    const relayPort = Behavon.createPort<RelayPortType>({ "relay": Behavon.SignalType(), "directSink": Behavon.SlotType(), "ingress": Behavon.SlotType() });
    function Relay(): undefined {
      const relaySignalBody = Behavon.useCallback((...args: readonly unknown[]) => {
        relaySignalBodies.push([...args]);
      }, []);
      const relaySignal = Behavon.useSignal(relayPort, "relay", relaySignalBody);
      Behavon.useExport(relayPort, "relay");
      const directSinkBody = Behavon.useCallback((...args: readonly unknown[]) => {
        directSinkCalls.push([...args]);
      }, []);
      const directSink = Behavon.useSlot(relayPort, "directSink", directSinkBody);
      const ingressBody = Behavon.useCallback((...args: readonly unknown[]) => {
        ingressCalls.push([...args]);
        relaySignal(...args);
        directSink(...args);
      }, [relaySignal, directSink]);
      Behavon.useSlot(relayPort, "ingress", ingressBody);
      return undefined;
    }

    type SinkPort1Type = { "receive": PortOnlySlot<any> };
    const sinkPort1 = Behavon.createPort<SinkPort1Type>({ "receive": Behavon.SlotType() });
    function Sink(): undefined {
      const receiveBody = Behavon.useCallback((...args: readonly unknown[]) => {
        connectedSinkCalls.push([...args]);
      }, []);
      Behavon.useSlot(sinkPort1, "receive", receiveBody);
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort3Type>), undefined);
    const relay = Behavon.createModel((Relay as unknown as Model<any, any, RelayPortType>), undefined);
    const sink = Behavon.createModel((Sink as unknown as Model<any, any, SinkPort1Type>), undefined);
    function App(): undefined {
      const relayDependency = Behavon.usePort(relay);
      const sinkDependency = Behavon.usePort(sink);
      Behavon.useConnect(signalOf(source, "fire"), relayDependency.ingress);
      Behavon.useConnect(signalOf(relay, "relay"), sinkDependency.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    fire?.("payload");
    expect(ingressCalls[0]).toHaveLength(2);
    expect(relaySignalBodies[0]).toEqual(ingressCalls[0]);
    expect(connectedSinkCalls[0]?.[0]).toBe("payload");
    expect(connectedSinkCalls[0]).toHaveLength(2);
    expect(connectedSinkCalls[0]?.[1]).not.toBe(ingressCalls[0]?.[1]);
    expect(directSinkCalls[0]?.[0]).toBe("payload");
    expect(directSinkCalls[0]).toHaveLength(2);
    expect(directSinkCalls[0]?.[1]).not.toBe(ingressCalls[0]?.[1]);
    root.dispose();
    sink.dispose();
    relay.dispose();
    source.dispose();
  });

  it("shares one frozen public metadata object per connection occurrence", () => {
    interface MultiSourceEndpoints {
      readonly fire: Signal<readonly [value: string]>;
    }
    interface MultiDestinationEndpoints {
      readonly receive: Slot<readonly [value: string]>;
    }
    const calls: Array<{ readonly body: string; readonly meta: ConnectionMeta }> = [];
    let fire: Signal<readonly [value: string]> | undefined;
    let sourceRef: TypedModelRef<any> | undefined;
    let destinationRef: TypedModelRef<any> | undefined;

    type SourcePort4Type = { "fire": PortOnlySignal<any> };
    const sourcePort4 = Behavon.createPort<SourcePort4Type>({ "fire": Behavon.SignalType() });
    function Source(): undefined {
      const fireBody = Behavon.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire = Behavon.useSignal(sourcePort4, "fire", fireBody);
      Behavon.useExport(sourcePort4, "fire");
      return undefined;
    }

    type DestinationPort1Type = { "receive": PortOnlySlot<any> };
    const destinationPort1 = Behavon.createPort<DestinationPort1Type>({ "receive": Behavon.SlotType() });
    function Destination(): undefined {
      const firstReceiveBody = Behavon.useCallback((_value: string, meta?: ConnectionMeta) => {
        if (meta === undefined) throw new Error("connected metadata is required");
        calls.push({ body: "first", meta });
      }, []);
      Behavon.useSlot(destinationPort1, "receive", firstReceiveBody);
      const secondReceiveBody = Behavon.useCallback((_value: string, meta?: ConnectionMeta) => {
        if (meta === undefined) throw new Error("connected metadata is required");
        calls.push({ body: "second", meta });
      }, []);
      Behavon.useSlot(destinationPort1, "receive", secondReceiveBody);
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort4Type>), undefined);
    const destination = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort1Type>), undefined);
    sourceRef = source;
    destinationRef = destination;
    function App(): undefined {
      const destinationDependency = Behavon.usePort(destination);
      const sourceEndpoint = signalOf(source, "fire");
      const destinationEndpoint = destinationDependency.receive;
      Behavon.useConnect(sourceEndpoint, destinationEndpoint);
      Behavon.useConnect(sourceEndpoint, destinationEndpoint);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    fire?.("value");
    expect(calls.map(({ body }) => body)).toEqual(["first", "second", "first", "second"]);
    expect(calls[0]?.meta).toBe(calls[1]?.meta);
    expect(calls[2]?.meta).toBe(calls[3]?.meta);
    expect(calls[0]?.meta).not.toBe(calls[2]?.meta);
    for (const { meta } of calls) {
      expect(Object.isFrozen(meta)).toBe(true);
      expect(meta).toMatchObject({
        source: sourceRef,
        signal: "fire",
        destination: destinationRef,
        slot: "receive",
      });
      expect(Reflect.ownKeys(meta).sort()).toEqual(["connection", "destination", "signal", "slot", "source"]);
    }
    root.dispose();
    destination.dispose();
    source.dispose();
  });

  it("lets a downstream synchronous Slot error fail an explicit Signal call", () => {
    const failure = new Error("downstream failed");
    let localSignal: Signal<readonly [value: number]> | undefined;
    let sourceBodyStarted = false;

    type SourcePort5Type = { "fire": PortOnlySignal<any> };
    const sourcePort5 = Behavon.createPort<SourcePort5Type>({ "fire": Behavon.SignalType() });
    function Source(): undefined {
      const fire = Behavon.useCallback(async (_value: number) => {
        sourceBodyStarted = true;
        await Promise.resolve();
        return "source-result";
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      localSignal = Behavon.useSignal(sourcePort5, "fire", fire);
      Behavon.useExport(sourcePort5, "fire");
      return undefined;
    }

    type DestinationPort2Type = { "receive": PortOnlySlot<any> };
    const destinationPort2 = Behavon.createPort<DestinationPort2Type>({ "receive": Behavon.SlotType() });
    function Destination(): undefined {
      const receive = Behavon.useCallback(() => {
        throw failure;
      }, []);
      Behavon.useSlot(destinationPort2, "receive", receive);
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort5Type>), undefined);
    const destination = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort2Type>), undefined);
    function App(): undefined {
      const destinationDependency = Behavon.usePort(destination);
      Behavon.useConnect(signalOf(source, "fire"), destinationDependency.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    expect(() => localSignal?.(1)).toThrow(failure);
    expect(sourceBodyStarted).toBe(true);
    root.dispose();
    destination.dispose();
    source.dispose();
  });

  it("surfaces connected async Slot rejections with the original reason", async () => {
    let sourceRef: TypedModelRef<any> | undefined;
    let nextReason: unknown;

    type SourcePort6Type = { "fire": PortOnlySignal<any> };
    const sourcePort6 = Behavon.createPort<SourcePort6Type>({ "fire": Behavon.SignalType() });
    function Source(): undefined {
      const fireBody = Behavon.useCallback((_value: number) => undefined, []);
      Behavon.useSignal(sourcePort6, "fire", fireBody);
      Behavon.useExport(sourcePort6, "fire");
      return undefined;
    }

    type DestinationPort3Type = { "receive": PortOnlySlot<any> };
    const destinationPort3 = Behavon.createPort<DestinationPort3Type>({ "receive": Behavon.SlotType() });
    function Destination(): undefined {
      const receiveBody = Behavon.useCallback(() => Promise.reject(nextReason), []);
      Behavon.useSlot(destinationPort3, "receive", receiveBody);
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort6Type>), undefined);
    const destination = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort3Type>), undefined);
    sourceRef = source;
    function App(): undefined {
      const destinationDependency = Behavon.usePort(destination);
      Behavon.useConnect(signalOf(source, "fire"), destinationDependency.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    const failure = new Error("connected async Slot failed");
    nextReason = failure;
    expect(await captureUnhandledRejection(() => signalOf(sourceRef, "fire")(1))).toBe(failure);
    nextReason = "connected primitive failure";
    expect(await captureUnhandledRejection(() => signalOf(sourceRef, "fire")(2))).toBe(nextReason);
    root.dispose();
    destination.dispose();
    source.dispose();
  });

  it("surfaces direct async Slot rejections with the original reason", async () => {
    let direct: Slot<readonly [value: number]> | undefined;
    let nextReason: unknown;

    type DestinationPort4Type = { "receive": PortOnlySlot<any> };
    const destinationPort4 = Behavon.createPort<DestinationPort4Type>({ "receive": Behavon.SlotType() });
    function Destination(): undefined {
      const receiveBody = Behavon.useCallback(
        (_value: number) =>
          ({
            then: (_resolve: (value: never) => void, reject: (reason: unknown) => void) => {
              reject(nextReason);
            },
          }),
        [],
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      direct = Behavon.useSlot(destinationPort4, "receive", receiveBody);
      return undefined;
    }

    const root = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort4Type>), undefined);
    const failure = new Error("direct async Slot failed");
    nextReason = failure;
    expect(await captureUnhandledRejection(() => direct?.(1))).toBe(failure);
    nextReason = "direct primitive failure";
    expect(await captureUnhandledRejection(() => direct?.(2))).toBe(nextReason);
    root.dispose();
  });

  for (const mode of ["direct", "connected"] as const) {
    it(`${mode} Slot observation uses Promise assimilation once and does not stop later dispatch`, async () => {
      const harness = createSlotObservationHarness(mode);
      let expectedSiblingCalls = 0;

      async function verify(result: unknown, expectedReason: unknown): Promise<void> {
        harness.setResult(result);
        let returned: unknown = Symbol("not called");
        const surfaced = await captureUnhandledRejection(() => {
          returned = harness.invoke();
        });
        expectedSiblingCalls += 1;
        expect(returned).toBeUndefined();
        expect(surfaced).toBe(expectedReason);
        expect(harness.siblingSlotCalls()).toBe(expectedSiblingCalls);
        expect(harness.laterConnectionCalls()).toBe(mode === "connected" ? expectedSiblingCalls : 0);
      }

      const nativeReason = new Error(`${mode} native rejection`);
      await verify(Promise.reject(nativeReason), nativeReason);

      const customReason = { mode, source: "custom reject" };
      let customMethodCalls = 0;
      await verify({
        then(_resolve: (value: unknown) => void, reject: (reason: unknown) => void): void {
          customMethodCalls += 1;
          reject(customReason);
        },
      }, customReason);
      expect(customMethodCalls).toBe(1);

      const methodReason = Symbol(`${mode} callable method throw`);
      let callableMethodCalls = 0;
      const callableThenable = Object.assign(
        () => undefined,
        {
          then(): never {
            callableMethodCalls += 1;
            throw methodReason;
          },
        },
      );
      await verify(callableThenable, methodReason);
      expect(callableMethodCalls).toBe(1);

      const getterReason = new Error(`${mode} getter throw`);
      let hasCalls = 0;
      let getterCalls = 0;
      const getterThrowingProxy = new Proxy({}, {
        has(): boolean {
          hasCalls += 1;
          return true;
        },
        get(target, property, receiver): unknown {
          if (property === "then") {
            getterCalls += 1;
            throw getterReason;
          }
          return Reflect.get(target, property, receiver);
        },
      });
      await verify(getterThrowingProxy, getterReason);
      expect(hasCalls).toBe(0);
      expect(getterCalls).toBe(1);

      const statefulReason = `${mode} stateful rejection`;
      let statefulGetterCalls = 0;
      let statefulMethodCalls = 0;
      const statefulThenable = Object.defineProperty({}, "then", {
        get(): unknown {
          statefulGetterCalls += 1;
          return (_resolve: (value: unknown) => void, reject: (reason: unknown) => void): void => {
            statefulMethodCalls += 1;
            reject(statefulReason);
          };
        },
      });
      await verify(statefulThenable, statefulReason);
      expect(statefulGetterCalls).toBe(1);
      expect(statefulMethodCalls).toBe(1);

      const constructorReason = { mode, source: "genuine Promise constructor" };
      let constructorCalls = 0;
      const constructorThrowingPromise = Object.defineProperty(Promise.resolve(undefined), "constructor", {
        get(): never {
          constructorCalls += 1;
          throw constructorReason;
        },
      });
      harness.setResult(constructorThrowingPromise);
      let constructorReturned: unknown = Symbol("not called");
      const constructorFailure = captureUnhandledRejection(() => {
        constructorReturned = harness.invoke();
      });
      expectedSiblingCalls += 1;
      expect(constructorReturned).toBeUndefined();
      expect(constructorCalls).toBe(0);
      expect(harness.siblingSlotCalls()).toBe(expectedSiblingCalls);
      expect(harness.laterConnectionCalls()).toBe(mode === "connected" ? expectedSiblingCalls : 0);
      expect(await constructorFailure).toBe(constructorReason);
      expect(constructorCalls).toBe(1);

      const promiseGetterReason = new Error(`${mode} genuine Promise then getter`);
      let promiseGetterCalls = 0;
      const getterThrowingPromise = Object.defineProperty(Promise.resolve(undefined), "then", {
        get(): never {
          promiseGetterCalls += 1;
          throw promiseGetterReason;
        },
      });
      await verify(getterThrowingPromise, promiseGetterReason);
      expect(promiseGetterCalls).toBe(1);

      const promiseMethodReason = Symbol(`${mode} genuine Promise then method`);
      let promiseMethodCalls = 0;
      const methodThrowingPromise = Object.defineProperty(Promise.resolve(undefined), "then", {
        value(): never {
          promiseMethodCalls += 1;
          throw promiseMethodReason;
        },
      });
      await verify(methodThrowingPromise, promiseMethodReason);
      expect(promiseMethodCalls).toBe(1);

      const promiseRejectReason = { mode, source: "genuine Promise own reject" };
      let promiseRejectCalls = 0;
      const rejectingPromise = Object.defineProperty(Promise.resolve(undefined), "then", {
        value(_resolve: (value: unknown) => void, reject: (reason: unknown) => void): void {
          promiseRejectCalls += 1;
          reject(promiseRejectReason);
        },
      });
      await verify(rejectingPromise, promiseRejectReason);
      expect(promiseRejectCalls).toBe(1);

      const nonCallablePromise = Object.defineProperty(Promise.resolve(undefined), "then", {
        value: 42,
      });
      harness.setResult(nonCallablePromise);
      expect(harness.invoke()).toBeUndefined();
      expectedSiblingCalls += 1;
      expect(harness.siblingSlotCalls()).toBe(expectedSiblingCalls);
      expect(harness.laterConnectionCalls()).toBe(mode === "connected" ? expectedSiblingCalls : 0);
      await Promise.resolve();

      let successMethodCalls = 0;
      const succeedingPromise = Object.defineProperty(Promise.resolve(undefined), "then", {
        value(resolve: (value: unknown) => void): void {
          successMethodCalls += 1;
          resolve(undefined);
        },
      });
      harness.setResult(succeedingPromise);
      expect(harness.invoke()).toBeUndefined();
      expectedSiblingCalls += 1;
      expect(successMethodCalls).toBe(0);
      expect(harness.siblingSlotCalls()).toBe(expectedSiblingCalls);
      expect(harness.laterConnectionCalls()).toBe(mode === "connected" ? expectedSiblingCalls : 0);
      await Promise.resolve();
      expect(successMethodCalls).toBe(1);

      harness.root.dispose();
    });
  }

  it("treats duplicate endpoint pairs as independent ordered connections", () => {
    const trace: number[] = [];
    let producerRef: TypedModelRef<any> | undefined;
    let disconnectFirst: (() => void) | undefined;
    let disconnectSecond: (() => void) | undefined;

    type ProducerPort2Type = { "fire": PortOnlySignal<any> };
    const producerPort2 = Behavon.createPort<ProducerPort2Type>({ "fire": Behavon.SignalType() });
    function Producer(): undefined {
      const fire = Behavon.useCallback((_value: number) => undefined, []);
      Behavon.useSignal(producerPort2, "fire", fire);
      Behavon.useExport(producerPort2, "fire");
      return undefined;
    }

    type ConsumerPort2Type = { "receive": PortOnlySlot<any> };
    const consumerPort2 = Behavon.createPort<ConsumerPort2Type>({ "receive": Behavon.SlotType() });
    function Consumer(): undefined {
      const receive = Behavon.useCallback((value: number) => trace.push(value), []);
      Behavon.useSlot(consumerPort2, "receive", receive);
      return undefined;
    }

    const producer = Behavon.createModel((Producer as unknown as Model<any, any, ProducerPort2Type>), undefined);
    const consumer = Behavon.createModel((Consumer as unknown as Model<any, any, ConsumerPort2Type>), undefined);
    producerRef = producer;
    function App(): undefined {
      const consumerDependency = Behavon.usePort(consumer);
      const source = signalOf(producer, "fire");
      const destination = consumerDependency.receive;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disconnectFirst = Behavon.useConnect(source, destination);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disconnectSecond = Behavon.useConnect(source, destination);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    signalOf(producerRef, "fire")(2);
    expect(trace).toEqual([2, 2]);
    disconnectFirst?.();
    signalOf(producerRef, "fire")(3);
    expect(trace).toEqual([2, 2, 3]);
    expect(() => disconnectFirst?.()).toThrow();
    disconnectSecond?.();
    root.dispose();
    consumer.dispose();
    producer.dispose();
  });

  it("skips a later connection whose destination is disposed during dispatch", () => {
    const trace: string[] = [];
    let sourceRef: TypedModelRef<any> | undefined;
    let lateRef: TypedModelRef<any> | undefined;

    type ProducerPort3Type = { "fire": PortOnlySignal<any> };
    const producerPort3 = Behavon.createPort<ProducerPort3Type>({ "fire": Behavon.SignalType() });
    function Producer(): undefined {
      const fire = Behavon.useCallback((_value: number) => undefined, []);
      Behavon.useSignal(producerPort3, "fire", fire);
      Behavon.useExport(producerPort3, "fire");
      return undefined;
    }

    type EarlyPortType = { "receive": PortOnlySlot<any> };
    const earlyPort = Behavon.createPort<EarlyPortType>({ "receive": Behavon.SlotType() });
    function Early(): undefined {
      const receive = Behavon.useCallback(() => {
        trace.push("early");
        lateRef?.dispose();
      }, []);
      Behavon.useSlot(earlyPort, "receive", receive);
      return undefined;
    }

    type LatePortType = { "receive": PortOnlySlot<any> };
    const latePort = Behavon.createPort<LatePortType>({ "receive": Behavon.SlotType() });
    function Late(): undefined {
      const receive = Behavon.useCallback(() => trace.push("late"), []);
      Behavon.useSlot(latePort, "receive", receive);
      return undefined;
    }

    const source = Behavon.createModel((Producer as unknown as Model<any, any, ProducerPort3Type>), undefined);
    const early = Behavon.createModel((Early as unknown as Model<any, any, EarlyPortType>), undefined);
    const late = Behavon.createModel((Late as unknown as Model<any, any, LatePortType>), undefined);
    sourceRef = source;
    lateRef = late;
    function App(): undefined {
      const earlyDestination = Behavon.usePort(early);
      const lateDestination = Behavon.usePort(late);
      const signal = signalOf(source, "fire");
      Behavon.useConnect(signal, earlyDestination.receive);
      Behavon.useConnect(signal, lateDestination.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    signalOf(sourceRef, "fire")(1);
    expect(trace).toEqual(["early"]);
    expect(() => lateRef?.dispose()).toThrow();
    root.dispose();
    early.dispose();
    source.dispose();
  });

  it("warns for a connection source with no Signal registration and rejects dispatch", () => {
    interface AmbiguousEndpoints {
      readonly event: Signal<readonly [value: number]> & Slot<readonly [value: number]>;
    }
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const received: number[] = [];
    let sourceRef: TypedModelRef<any> | undefined;

    type SlotOnlyPortType = { "event": PortOnlySlot<any> };
    const slotOnlyPort = Behavon.createPort<SlotOnlyPortType>({ "event": Behavon.SlotType() });
    function SlotOnly(): undefined {
      const body = Behavon.useCallback((_value: number) => undefined, []);
      Behavon.useSlot(slotOnlyPort, "event", body);
      return undefined;
    }

    type DestinationPort5Type = { "event": PortOnlySlot<any> };
    const destinationPort5 = Behavon.createPort<DestinationPort5Type>({ "event": Behavon.SlotType() });
    function Destination(): undefined {
      const body = Behavon.useCallback((value: number) => received.push(value), []);
      Behavon.useSlot(destinationPort5, "event", body);
      return undefined;
    }

    const source = Behavon.createModel((SlotOnly as unknown as Model<any, any, SlotOnlyPortType>), undefined);
    const destination = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort5Type>), undefined);
    sourceRef = source;
    function App(): undefined {
      const sourceDependency = Behavon.usePort(source);
      const destinationDependency = Behavon.usePort(destination);
      // Invalid authoring probe: a Slot passed where a Signal is expected.
      Behavon.useConnect(sourceDependency.event as never, destinationDependency.event);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    expect(() => sourceRef?.event(5)).toThrow(/no Signal registration/);
    expect(received).toEqual([]);
    expect(warning).toHaveBeenCalled();
    root.dispose();
    destination.dispose();
    source.dispose();
    warning.mockRestore();
  });

  it("rejects a Signal-only destination before connecting", () => {
    const destinationSignalBodies: number[] = [];

    type SourcePort7Type = { "event": PortOnlySignal<any> };
    const sourcePort7 = Behavon.createPort<SourcePort7Type>({ "event": Behavon.SignalType() });
    function Source(): undefined {
      const eventBody = Behavon.useCallback((_value: number) => undefined, []);
      Behavon.useSignal(sourcePort7, "event", eventBody);
      Behavon.useExport(sourcePort7, "event");
      return undefined;
    }

    type SignalOnlyDestinationPortType = { "event": PortOnlySignal<any> };
    const signalOnlyDestinationPort = Behavon.createPort<SignalOnlyDestinationPortType>({ "event": Behavon.SignalType() });
    function SignalOnlyDestination(): undefined {
      const eventBody = Behavon.useCallback((value: number) => destinationSignalBodies.push(value), []);
      Behavon.useSignal(signalOnlyDestinationPort, "event", eventBody);
      Behavon.useExport(signalOnlyDestinationPort, "event");
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort7Type>), undefined);
    const destination = Behavon.createModel((SignalOnlyDestination as unknown as Model<any, any, SignalOnlyDestinationPortType>), undefined);
    function App(): undefined {
      const destinationDependency = Behavon.usePort(destination);
      // Invalid authoring probe: a Signal passed where a Slot is expected.
      Behavon.useConnect(signalOf(source, "event"), destinationDependency.event as never);
      return undefined;
    }

    expect(() => Behavon.createModel(App, undefined)).toThrow(/useConnect destination must b/);
    expect(destinationSignalBodies).toEqual([]);
    destination.dispose();
    source.dispose();
  });

  it("separates a shared callback from Signal A, Signal B, and ingress Slot occurrences", () => {
    interface SharedEndpoints {
      readonly a: Signal<readonly [value: number]>;
      readonly b: Signal<readonly [value: number]>;
      readonly ingress: Slot<readonly [value: number]>;
    }
    interface SinkEndpoints {
      readonly receiveA: Slot<readonly [value: number]>;
      readonly receiveB: Slot<readonly [value: number]>;
    }

    const bodies: number[] = [];
    const receivedA: number[] = [];
    const receivedB: number[] = [];
    let callback: ((value: number) => void) | undefined;
    let signalA: Signal<readonly [value: number]> | undefined;
    let signalB: Signal<readonly [value: number]> | undefined;
    let ingress: Slot<readonly [value: number]> | undefined;

    type SourcePort8Type = { "a": PortOnlySignal<any>; "b": PortOnlySignal<any>; "ingress": PortOnlySlot<any> };
    const sourcePort8 = Behavon.createPort<SourcePort8Type>({ "a": Behavon.SignalType(), "b": Behavon.SignalType(), "ingress": Behavon.SlotType() });
    function Source(): undefined {
      const shared = Behavon.useCallback((value: number) => {
        bodies.push(value);
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callback = shared;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signalA = Behavon.useSignal(sourcePort8, "a", shared);
      Behavon.useExport(sourcePort8, "a");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signalB = Behavon.useSignal(sourcePort8, "b", shared);
      Behavon.useExport(sourcePort8, "b");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      ingress = Behavon.useSlot(sourcePort8, "ingress", shared);
      return undefined;
    }

    type SinkPort2Type = { "receiveA": PortOnlySlot<any>; "receiveB": PortOnlySlot<any> };
    const sinkPort2 = Behavon.createPort<SinkPort2Type>({ "receiveA": Behavon.SlotType(), "receiveB": Behavon.SlotType() });
    function Sink(): undefined {
      const receiveABody = Behavon.useCallback((value: number) => receivedA.push(value), []);
      Behavon.useSlot(sinkPort2, "receiveA", receiveABody);
      const receiveBBody = Behavon.useCallback((value: number) => receivedB.push(value), []);
      Behavon.useSlot(sinkPort2, "receiveB", receiveBBody);
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort8Type>), undefined);
    const sink = Behavon.createModel((Sink as unknown as Model<any, any, SinkPort2Type>), undefined);
    function App(): undefined {
      const sinkEndpoints = Behavon.usePort(sink);
      Behavon.useConnect(signalOf(source, "a"), sinkEndpoints.receiveA);
      Behavon.useConnect(signalOf(source, "b"), sinkEndpoints.receiveB);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    callback?.(1);
    ingress?.(2);
    expect(bodies).toEqual([1, 2]);
    expect(receivedA).toEqual([]);
    expect(receivedB).toEqual([]);

    signalA?.(3);
    expect(receivedA).toEqual([3]);
    expect(receivedB).toEqual([]);

    signalB?.(4);
    expect(receivedA).toEqual([3]);
    expect(receivedB).toEqual([4]);
    root.dispose();
    sink.dispose();
    source.dispose();
  });

  it("invokes a direct Slot through one virtual connection with temporary metadata", () => {
    const traces: Array<{ readonly body: string; readonly value: number; readonly meta?: ConnectionMeta }> = [];
    let direct: Slot<readonly [value: number]> | undefined;
    let plainCallback: ((value: number) => string) | undefined;

    type DestinationPort6Type = { "receive": PortOnlySlot<any> };
    const destinationPort6 = Behavon.createPort<DestinationPort6Type>({ "receive": Behavon.SlotType() });
    function Destination(): undefined {
      const first = Behavon.useCallback((value: number, meta?: ConnectionMeta) => {
        traces.push({ body: "first", value, meta });
        return "ignored";
      }, []);
      const second = Behavon.useCallback((value: number, meta?: ConnectionMeta) => {
        traces.push({ body: "second", value, meta });
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      plainCallback = first as (value: number) => string;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      direct = Behavon.useSlot(destinationPort6, "receive", first);
      Behavon.useSlot(destinationPort6, "receive", second);
      return undefined;
    }

    const root = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort6Type>), undefined);
    expect(plainCallback?.(1)).toBe("ignored");
    expect(traces).toEqual([{ body: "first", value: 1, meta: undefined }]);
    traces.length = 0;

    expect(direct?.(2)).toBeUndefined();
    expect(traces.map(({ body, value }) => ({ body, value }))).toEqual([
      { body: "first", value: 2 },
      { body: "second", value: 2 },
    ]);
    const firstMeta = traces[0]?.meta;
    expect(firstMeta).toMatchObject({ signal: "receive", slot: "receive" });
    expect(firstMeta?.destination).toBe(root);
    expect(firstMeta?.source).not.toBe(root);
    expect(firstMeta?.connection).toBe(traces[1]?.meta?.connection);

    traces.length = 0;
    direct?.(3);
    expect(traces[0]?.meta?.source).not.toBe(firstMeta?.source);
    expect(traces[0]?.meta?.connection).not.toBe(firstMeta?.connection);
    root.dispose();
  });

  it("stops a direct Slot dispatch on the first synchronous body error", () => {
    const failure = new Error("direct slot failed");
    const trace: string[] = [];
    let direct: Slot | undefined;

    type DestinationPort7Type = { "receive": PortOnlySlot<any> };
    const destinationPort7 = Behavon.createPort<DestinationPort7Type>({ "receive": Behavon.SlotType() });
    function Destination(): undefined {
      const first = Behavon.useCallback(() => {
        trace.push("first");
        throw failure;
      }, []);
      const second = Behavon.useCallback(() => trace.push("second"), []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      direct = Behavon.useSlot(destinationPort7, "receive", first);
      Behavon.useSlot(destinationPort7, "receive", second);
      return undefined;
    }

    const root = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort7Type>), undefined);
    expect(() => direct?.()).toThrow(failure);
    expect(trace).toEqual(["first"]);
    root.dispose();
  });

  it("stops Signal and direct Slot fan-out when an earlier body disposes their owner", () => {
    const signalTrace: string[] = [];
    const slotTrace: string[] = [];
    let signalRoot: TypedModelRef<any> | undefined;
    let directSlot: Slot | undefined;
    let slotRoot: TypedModelRef<any> | undefined;

    interface SignalEndpoints {
      readonly fire: Signal;
    }

    type SignalModelPortType = { "fire": PortOnlySignal<any> };
    const signalModelPort = Behavon.createPort<SignalModelPortType>({ "fire": Behavon.SignalType() });
    function SignalModel(): undefined {
      const first = Behavon.useCallback(() => {
        signalTrace.push("first");
        signalRoot?.dispose();
      }, []);
      const second = Behavon.useCallback(() => signalTrace.push("second"), []);
      Behavon.useSignal(signalModelPort, "fire", first);
      Behavon.useSignal(signalModelPort, "fire", second);
      Behavon.useExport(signalModelPort, "fire");
      return undefined;
    }

    signalRoot = Behavon.createModel((SignalModel as unknown as Model<any, any, SignalModelPortType>), undefined);
    expect(() => signalOf(signalRoot, "fire")()).toThrow(/disposed during Signal 'fire' dispatch/);
    expect(signalTrace).toEqual(["first"]);

    type SlotModelPortType = { "receive": PortOnlySlot<any> };
    const slotModelPort = Behavon.createPort<SlotModelPortType>({ "receive": Behavon.SlotType() });
    function SlotModel(): undefined {
      const first = Behavon.useCallback(() => {
        slotTrace.push("first");
        slotRoot?.dispose();
      }, []);
      const second = Behavon.useCallback(() => slotTrace.push("second"), []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      directSlot = Behavon.useSlot(slotModelPort, "receive", first);
      Behavon.useSlot(slotModelPort, "receive", second);
      return undefined;
    }

    slotRoot = Behavon.createModel((SlotModel as unknown as Model<any, any, SlotModelPortType>), undefined);
    expect(() => directSlot?.()).toThrow(/disposed during Slot 'receive' dispatch/);
    expect(slotTrace).toEqual(["first"]);
  });

  it("stops connected Slot fan-out when an earlier body disposes the destination", () => {
    interface ZeroProducerEndpoints {
      readonly fire: Signal;
    }
    interface ZeroConsumerEndpoints {
      readonly receive: Slot;
    }
    const trace: string[] = [];
    let signal: Signal | undefined;
    let destinationRef: TypedModelRef<any> | undefined;

    type SourcePort9Type = { "fire": PortOnlySignal<any> };
    const sourcePort9 = Behavon.createPort<SourcePort9Type>({ "fire": Behavon.SignalType() });
    function Source(): undefined {
      const fireBody = Behavon.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signal = Behavon.useSignal(sourcePort9, "fire", fireBody);
      Behavon.useExport(sourcePort9, "fire");
      return undefined;
    }

    type DestinationPort8Type = { "receive": PortOnlySlot<any> };
    const destinationPort8 = Behavon.createPort<DestinationPort8Type>({ "receive": Behavon.SlotType() });
    function Destination(): undefined {
      const first = Behavon.useCallback(() => {
        trace.push("first");
        destinationRef?.dispose();
      }, []);
      const second = Behavon.useCallback(() => trace.push("second"), []);
      Behavon.useSlot(destinationPort8, "receive", first);
      Behavon.useSlot(destinationPort8, "receive", second);
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort9Type>), undefined);
    const destination = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort8Type>), undefined);
    destinationRef = destination;
    function App(): undefined {
      const destinationDependency = Behavon.usePort(destination);
      Behavon.useConnect(signalOf(source, "fire"), destinationDependency.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    expect(() => signal?.()).toThrow(/disposed during connection destination 'receive'/);
    expect(trace).toEqual(["first"]);
    root.dispose();
    source.dispose();
  });

  it("stops before a later active connection when an earlier destination Slot throws", () => {
    interface ZeroProducerEndpoints {
      readonly fire: Signal;
    }
    interface ZeroConsumerEndpoints {
      readonly receive: Slot;
    }
    const failure = new Error("first connection failed");
    const trace: string[] = [];
    let signal: Signal | undefined;

    type SourcePort10Type = { "fire": PortOnlySignal<any> };
    const sourcePort10 = Behavon.createPort<SourcePort10Type>({ "fire": Behavon.SignalType() });
    function Source(): undefined {
      const fireBody = Behavon.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signal = Behavon.useSignal(sourcePort10, "fire", fireBody);
      Behavon.useExport(sourcePort10, "fire");
      return undefined;
    }

    type EarlyPort1Type = { "receive": PortOnlySlot<any> };
    const earlyPort1 = Behavon.createPort<EarlyPort1Type>({ "receive": Behavon.SlotType() });
    function Early(): undefined {
      const receiveBody = Behavon.useCallback(() => {
        trace.push("early");
        throw failure;
      }, []);
      Behavon.useSlot(earlyPort1, "receive", receiveBody);
      return undefined;
    }

    type LatePort1Type = { "receive": PortOnlySlot<any> };
    const latePort1 = Behavon.createPort<LatePort1Type>({ "receive": Behavon.SlotType() });
    function Late(): undefined {
      const receiveBody = Behavon.useCallback(() => trace.push("late"), []);
      Behavon.useSlot(latePort1, "receive", receiveBody);
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort10Type>), undefined);
    const early = Behavon.createModel((Early as unknown as Model<any, any, EarlyPort1Type>), undefined);
    const late = Behavon.createModel((Late as unknown as Model<any, any, LatePort1Type>), undefined);
    function App(): undefined {
      const earlyDestination = Behavon.usePort(early);
      const lateDestination = Behavon.usePort(late);
      const sourceEndpoint = signalOf(source, "fire");
      Behavon.useConnect(sourceEndpoint, earlyDestination.receive);
      Behavon.useConnect(sourceEndpoint, lateDestination.receive);
      return undefined;
    }

    const root = Behavon.createModel(App, undefined);
    expect(() => signal?.()).toThrow(failure);
    expect(trace).toEqual(["early"]);
    root.dispose();
    late.dispose();
    early.dispose();
    source.dispose();
  });

  it("warns and executes evaluation-time Signal and Slot calls while leaving callbacks and effects warning-free", () => {
    const trace: string[] = [];
    let invoke: (() => void) | undefined;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    type AllowedPortType = { "fire": PortOnlySignal<any>; "receive": PortOnlySlot<any> };
    const allowedPort = Behavon.createPort<AllowedPortType>({ "fire": Behavon.SignalType(), "receive": Behavon.SlotType() });
    function Allowed(): undefined {
      const fireBody = Behavon.useCallback(() => trace.push("signal"), []);
      const signal = Behavon.useSignal(allowedPort, "fire", fireBody);
      Behavon.useExport(allowedPort, "fire");
      const receiveBody = Behavon.useCallback(() => trace.push("slot"), []);
      const slot = Behavon.useSlot(allowedPort, "receive", receiveBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      invoke = Behavon.useCallback(() => {
        signal();
        slot();
        trace.push("callback-end");
      }, [signal, slot]);
      Behavon.useEffect(() => {
        signal();
        slot();
        trace.push("effect-end");
      }, [signal, slot]);
      return undefined;
    }

    const root = Behavon.createModel((Allowed as unknown as Model<any, any, AllowedPortType>), undefined);
    expect(trace).toEqual(["signal", "slot", "effect-end"]);
    expect(warning).not.toHaveBeenCalled();
    invoke?.();
    expect(trace).toEqual(["signal", "slot", "effect-end", "signal", "slot", "callback-end"]);
    expect(warning).not.toHaveBeenCalled();
    root.dispose();

    type EvaluationSignalPortType = { "fire": PortOnlySignal<any> };
    const evaluationSignalPort = Behavon.createPort<EvaluationSignalPortType>({ "fire": Behavon.SignalType() });
    function EvaluationSignal(): undefined {
      const fireBody = Behavon.useCallback(() => trace.push("evaluation-signal"), []);
      const signal = Behavon.useSignal(evaluationSignalPort, "fire", fireBody);
      Behavon.useExport(evaluationSignalPort, "fire");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      const immediate = Behavon.useCallback(() => signal(), [signal]);
      immediate();
      return undefined;
    }
    const signalRoot = Behavon.createModel((EvaluationSignal as unknown as Model<any, any, EvaluationSignalPortType>), undefined);
    expect(trace.at(-1)).toBe("evaluation-signal");
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(
      /Model#\d+ called Signal 'fire' on Model#\d+ while evaluating.*Behavon\.useEffect.*managed callback/,
    ));

    type EvaluationSlotPortType = { "receive": PortOnlySlot<any> };
    const evaluationSlotPort = Behavon.createPort<EvaluationSlotPortType>({ "receive": Behavon.SlotType() });
    function EvaluationSlot(): undefined {
      const receiveBody = Behavon.useCallback(() => trace.push("evaluation-slot"), []);
      const slot = Behavon.useSlot(evaluationSlotPort, "receive", receiveBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slot();
      return undefined;
    }
    const slotRoot = Behavon.createModel((EvaluationSlot as unknown as Model<any, any, EvaluationSlotPortType>), undefined);
    expect(trace.at(-1)).toBe("evaluation-slot");
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(
      /Model#\d+ called Slot 'receive' on Model#\d+ while evaluating.*Behavon\.useEffect.*managed callback/,
    ));
    signalRoot.dispose();
    slotRoot.dispose();
    warning.mockRestore();
  });

  it("uses the current endpoint candidate and committed connection graph during evaluation dispatch", async () => {
    const trace: string[] = [];
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    type SourcePort11Type = { "advance": PortOnlySignal<any>; "fire": PortOnlySignal<any> };
    const sourcePort11 = Behavon.createPort<SourcePort11Type>({ "advance": Behavon.SignalType(), "fire": Behavon.SignalType() });
    function Source(): undefined {
      const [value, setValue] = Behavon.useState(0);
      const advance = Behavon.useCallback(() => setValue(1), [setValue]);
      Behavon.useSignal(sourcePort11, "advance", advance);
      Behavon.useExport(sourcePort11, "advance");
      const fireBody = Behavon.useCallback((next: number) => trace.push(`body:${next}:${value}`), [value]);
      const fire = Behavon.useSignal(sourcePort11, "fire", fireBody);
      Behavon.useExport(sourcePort11, "fire");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire(value);
      return undefined;
    }
    type DestinationPort9Type = { "receive": PortOnlySlot<any> };
    const destinationPort9 = Behavon.createPort<DestinationPort9Type>({ "receive": Behavon.SlotType() });
    function Destination(): undefined {
      const receive = Behavon.useCallback((value: number) => trace.push(`slot:${value}`), []);
      Behavon.useSlot(destinationPort9, "receive", receive);
      return undefined;
    }

    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort11Type>), undefined);
    const destination = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort9Type>), undefined);
    function Connector(): undefined {
      const destinationDependency = Behavon.usePort(destination);
      Behavon.useConnect(signalOf(source, "fire"), destinationDependency.receive);
      return undefined;
    }
    const connector = Behavon.createModel(Connector, undefined);
    trace.length = 0;
    signalOf(source, "advance")();
    await waitFor(() => trace.length === 2);
    expect(trace).toEqual(["body:1:1", "slot:1"]);
    expect(warning).toHaveBeenCalledTimes(1);
    connector.dispose();
    destination.dispose();
    source.dispose();
    warning.mockRestore();
  });

  it("warns and executes public-ref and dependency-proxy dispatch during evaluation", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const trace: string[] = [];
    interface TargetPort { fire: Signal<[source: string]> }
    const targetPort = Behavon.createPort<TargetPort>({ fire: Behavon.SignalType() });
    function Target(): undefined {
      const fireBody = Behavon.useCallback((source: string) => trace.push(source), []);
      Behavon.useSignal(targetPort, "fire", fireBody);
      Behavon.useExport(targetPort, "fire");
      return undefined;
    }
    const target = Behavon.createModel(Target as Model<undefined, undefined, TargetPort>, undefined);

    function PublicCaller(): undefined {
      // test-only probe -- runtime-known public-ref dispatch is invalid authoring during evaluation
      target.fire("public");
      return undefined;
    }
    function DependencyCaller(): undefined {
      const dependency = Behavon.usePort(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      dependency.fire("dependency");
      return undefined;
    }

    const publicCaller = Behavon.createModel(PublicCaller, undefined);
    const dependencyCaller = Behavon.createModel(DependencyCaller, undefined);
    expect(trace).toEqual(["public", "dependency"]);
    expect(warning).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenNthCalledWith(1, expect.stringMatching(/Signal 'fire' on Model#\d+/));
    expect(warning).toHaveBeenNthCalledWith(2, expect.stringMatching(/Signal 'fire' on Model#\d+/));
    dependencyCaller.dispose();
    publicCaller.dispose();
    target.dispose();
    warning.mockRestore();
  });

  it("deduplicates evaluation dispatch warnings and preserves synchronous fail-fast errors", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const trace: string[] = [];
    type RetryingPortType = { "fire": PortOnlySignal<any> };
    const retryingPort = Behavon.createPort<RetryingPortType>({ "fire": Behavon.SignalType() });
    function Retrying(): undefined {
      const [value, setValue] = Behavon.useState(0);
      const first = Behavon.useCallback(() => trace.push(`first:${value}`), [value]);
      const fire = Behavon.useSignal(retryingPort, "fire", first);
      Behavon.useExport(retryingPort, "fire");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire();
      if (value === 0) setValue(1);
      return undefined;
    }
    const retrying = Behavon.createModel((Retrying as unknown as Model<any, any, RetryingPortType>), undefined);
    expect(trace).toEqual(["first:0", "first:1"]);
    expect(warning).toHaveBeenCalledTimes(1);
    retrying.dispose();

    const failure = new Error("evaluation signal failed");
    type BrokenPortType = { "fire": PortOnlySignal<any> };
    const brokenPort = Behavon.createPort<BrokenPortType>({ "fire": Behavon.SignalType() });
    function Broken(): never {
      const first = Behavon.useCallback(() => {
        trace.push("throw");
        throw failure;
      }, []);
      const second = Behavon.useCallback(() => trace.push("later"), []);
      const fire = Behavon.useSignal(brokenPort, "fire", first);
      Behavon.useSignal(brokenPort, "fire", second);
      Behavon.useExport(brokenPort, "fire");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire();
      throw new Error("unreachable");
    }
    expect(() => Behavon.createModel((Broken as unknown as Model<any, any, BrokenPortType>), undefined)).toThrow(failure);
    expect(trace.slice(-1)).toEqual(["throw"]);
    warning.mockRestore();
  });

  it("attributes an evaluation-time external dispatch failure to the evaluator and keeps the target live", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failure = new Error("external evaluation dispatch failed");
    const trace: string[] = [];
    interface TargetPort { fire: Signal }
    const targetPort = Behavon.createPort<TargetPort>({ fire: Behavon.SignalType() });
    function Target(): undefined {
      const first = Behavon.useCallback(() => {
        trace.push("first");
        throw failure;
      }, []);
      const second = Behavon.useCallback(() => trace.push("second"), []);
      Behavon.useSignal(targetPort, "fire", first);
      Behavon.useSignal(targetPort, "fire", second);
      Behavon.useExport(targetPort, "fire");
      return undefined;
    }
    const target = Behavon.createModel(Target as Model<undefined, undefined, TargetPort>, undefined);
    function Caller(): undefined {
      const dependency = Behavon.usePort(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      dependency.fire();
      return undefined;
    }

    expect(() => Behavon.createModel(Caller, undefined)).toThrow(failure);
    expect(() => Behavon.getInterface(target)).not.toThrow();
    expect(trace).toEqual(["first"]);
    expect(() => target.fire()).toThrow(failure);
    expect(trace).toEqual(["first", "first"]);
    target.dispose();
    warning.mockRestore();
  });

  it("retargets an active connection at commit without changing its disconnect identity", async () => {
    interface ParentEndpoints { readonly retarget: Signal; }
    const deliveries: number[] = [];
    const disconnects: Array<() => void> = [];
    let sourceRef: TypedModelRef<any> | null = null;

    type SourcePort12Type = { "fire": PortOnlySignal<any> };
    const sourcePort12 = Behavon.createPort<SourcePort12Type>({ "fire": Behavon.SignalType() });
    function Source(): undefined {
      const fireBody = Behavon.useCallback((_value: number) => undefined, []);
      Behavon.useSignal(sourcePort12, "fire", fireBody);
      Behavon.useExport(sourcePort12, "fire");
      return undefined;
    }
    type DestinationPort10Type = { "receive": PortOnlySlot<any> };
    const destinationPort10 = Behavon.createPort<DestinationPort10Type>({ "receive": Behavon.SlotType() });
    function Destination(id: number): undefined {
      const receiveBody = Behavon.useCallback((_value: number) => deliveries.push(id), [id]);
      Behavon.useSlot(destinationPort10, "receive", receiveBody);
      return undefined;
    }
    const source = Behavon.createModel((Source as unknown as Model<any, any, SourcePort12Type>), undefined);
    const first = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort10Type>), 1);
    const second = Behavon.createModel((Destination as unknown as Model<any, any, DestinationPort10Type>), 2);
    type ParentPortType = { "retarget": PortOnlySignal<any> };
    const parentPort = Behavon.createPort<ParentPortType>({ "retarget": Behavon.SignalType() });
    function Parent(): undefined {
      const [target, setTarget] = Behavon.useState(1);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      sourceRef = source;
      const destinationDependency = Behavon.usePort(target === 1 ? first : second);
      const disconnect = Behavon.useConnect(signalOf(source, "fire"), destinationDependency.receive);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disconnects.push(disconnect);
      const retarget = Behavon.useCallback(() => setTarget(2), [setTarget]);
      Behavon.useSignal(parentPort, "retarget", retarget);
      Behavon.useExport(parentPort, "retarget");
      return undefined;
    }

    const root = Behavon.createModel((Parent as unknown as Model<any, any, ParentPortType>), undefined);
    signalOf(sourceRef!, "fire")(1);
    expect(deliveries).toEqual([1]);
    signalOf(root, "retarget")();
    await waitFor(() => disconnects.length === 2);
    expect(disconnects[1]).toBe(disconnects[0]);
    signalOf(sourceRef!, "fire")(2);
    expect(deliveries).toEqual([1, 2]);
    root.dispose();
    second.dispose();
    first.dispose();
    source.dispose();
  });
});
