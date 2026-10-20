import { describe, expect, it, vi } from "vitest";
import Behave from "behavon";
import type { ConnectionMeta, Signal, Slot, UntypedModelRef } from "behavon";
import { waitFor } from "../helpers";

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

  function Source(): undefined {
    const fireBody = Behave.useCallback(() => undefined, []);
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    signal = Behave.useSignal("fire", fireBody);
    return undefined;
  }

  function FirstDestination(): undefined {
    const observedBody = Behave.useCallback((): unknown => nextResult, []);
    const siblingBody = Behave.useCallback(() => {
      siblingCalls += 1;
    }, []);
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    direct = Behave.useSlot("receive", observedBody);
    Behave.useSlot("receive", siblingBody);
    return undefined;
  }

  function LaterDestination(): undefined {
    const receiveBody = Behave.useCallback(() => {
      laterCalls += 1;
    }, []);
    Behave.useSlot("receive", receiveBody);
    return undefined;
  }

  const source = mode === "connected" ? Behave.createModel(Source, undefined) : undefined;
  const first = mode === "connected" ? Behave.createModel(FirstDestination, undefined) : undefined;
  const later = mode === "connected" ? Behave.createModel(LaterDestination, undefined) : undefined;
  function ConnectedApp(): undefined {
    if (source === undefined || first === undefined || later === undefined) {
      throw new Error("connected roots must be assembled before the connection owner");
    }
    const sourceDependency = Behave.usePort(source);
    const firstDestination = Behave.usePort(first);
    const laterDestination = Behave.usePort(later);
    const fire = sourceDependency.fire;
    Behave.useConnect(fire, firstDestination.receive);
    Behave.useConnect(fire, laterDestination.receive);
    return undefined;
  }

  const connectionOwner = mode === "direct"
    ? Behave.createModel(FirstDestination, undefined)
    : Behave.createModel(ConnectedApp, undefined);
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

  function Source(): undefined {
    const fireBody = Behave.useCallback((...args: readonly unknown[]) => {
      signalBodies.push([...args]);
    }, []);
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    signal = Behave.useSignal("fire", fireBody);
    return undefined;
  }

  function Destination(): undefined {
    const receiveBody = Behave.useCallback((...args: readonly unknown[]) => {
      slotBodies.push([...args]);
    }, []);
    // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
    directSlot = Behave.useSlot("receive", receiveBody);
    return undefined;
  }

  const source = Behave.createModel(Source, undefined);
  const destination = Behave.createModel(Destination, undefined);
  function App(): undefined {
    const producer = Behave.usePort(source);
    const consumer = Behave.usePort(destination);
    Behave.useConnect(producer.fire, consumer.receive);
    return undefined;
  }

  const connectionOwner = Behave.createModel(App, undefined);
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

    function Model(): undefined {
      const signalBody = Behave.useCallback(function (this: void, _value: string) {
        signalReceivers.push(this);
      }, []);
      const slotBody = Behave.useCallback(function (this: void, _value: string) {
        slotReceivers.push(this);
      }, []);
      const fire = Behave.useSignal("fire", signalBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      const receive = directSlot = Behave.useSlot("receive", slotBody);
      Behave.useConnect(fire, receive);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    try {
      root.fire("connected");
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

    function Producer(): undefined {
      const first = Behave.useCallback((value: number) => {
        trace.push(`P1:${value}`);
        return "first";
      }, []);
      const second = Behave.useCallback((value: number) => {
        trace.push(`P2:${value}`);
        return "second";
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      localFirst = first;
      Behave.useSignal("fire", first);
      Behave.useSignal("fire", second);
      return undefined;
    }

    function Consumer(): undefined {
      const first = Behave.useCallback((value: number, meta?: ConnectionMeta) => {
        trace.push(`S1:${value}`);
        if (meta !== undefined) metadata.push(meta);
      }, []);
      const second = Behave.useCallback((value: number) => trace.push(`S2:${value}`), []);
      Behave.useSlot("receive", first);
      Behave.useSlot("receive", second);
      return undefined;
    }

    const producerRef = Behave.createModel(Producer, undefined);
    const consumerRef = Behave.createModel(Consumer, undefined);
    function App(): undefined {
      const producer = producerRef;
      const consumer = consumerRef;
      const source = Behave.usePort(producer);
      const destination = Behave.usePort(consumer);
      Behave.useConnect(source.fire, destination.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    expect(producerRef?.fire(3)).toBeUndefined();
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

    function Producer(): undefined {
      const first = Behave.useCallback((value: number) => trace.push(`P1:${value}`), []);
      const second = Behave.useCallback(() => {
        trace.push("P2");
        throw failure;
      }, []);
      Behave.useSignal("fire", first);
      Behave.useSignal("fire", second);
      return undefined;
    }

    function Consumer(): undefined {
      const receive = Behave.useCallback(() => trace.push("S"), []);
      Behave.useSlot("receive", receive);
      return undefined;
    }

    const producerRef = Behave.createModel(Producer, undefined);
    const consumerRef = Behave.createModel(Consumer, undefined);
    function App(): undefined {
      const producer = producerRef;
      const consumer = consumerRef;
      const producerDependency = Behave.usePort(producer);
      const consumerDependency = Behave.usePort(consumer);
      Behave.useConnect(producerDependency.fire, consumerDependency.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    expect(() => producerRef?.fire(1)).toThrow(failure);
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

    function Source(): undefined {
      const fireBody = Behave.useCallback((_value: number) => undefined, []);
      Behave.useSignal("fire", fireBody);
      return undefined;
    }

    function Relay(): undefined {
      const relaySignalBody = Behave.useCallback((_value: number) => undefined, []);
      const relaySignal = Behave.useSignal("relay", relaySignalBody);
      const relay = Behave.useCallback((...args: readonly unknown[]) => {
        relayArguments.push([...args]);
        relaySignal(args[0] as number);
      }, [relaySignal]);
      Behave.useSlot("relay", relay);
      return undefined;
    }

    function Sink(): undefined {
      const receive = Behave.useCallback((...args: readonly unknown[]) => {
        sinkArguments.push([...args]);
      }, []);
      Behave.useSlot("receive", receive);
      return undefined;
    }

    const sourceRef = Behave.createModel(Source, undefined);
    const relayRef = Behave.createModel(Relay, undefined);
    const sinkRef = Behave.createModel(Sink, undefined);
    function App(): undefined {
      const source = sourceRef;
      const relay = relayRef;
      const sink = sinkRef;
      const sourceDependency = Behave.usePort(source);
      const relayDependency = Behave.usePort(relay);
      const sinkDependency = Behave.usePort(sink);
      Behave.useConnect(sourceDependency.fire, relayDependency.relay);
      Behave.useConnect(relayDependency.relay, sinkDependency.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    sourceRef?.fire(9);
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

    function Source(): undefined {
      const fireBody = Behave.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire = Behave.useSignal("fire", fireBody);
      return undefined;
    }

    function Relay(): undefined {
      const relaySignalBody = Behave.useCallback((...args: readonly unknown[]) => {
        relaySignalBodies.push([...args]);
      }, []);
      const relaySignal = Behave.useSignal("relay", relaySignalBody);
      const directSinkBody = Behave.useCallback((...args: readonly unknown[]) => {
        directSinkCalls.push([...args]);
      }, []);
      const directSink = Behave.useSlot("directSink", directSinkBody);
      const ingressBody = Behave.useCallback((...args: readonly unknown[]) => {
        ingressCalls.push([...args]);
        relaySignal(...args);
        directSink(...args);
      }, [relaySignal, directSink]);
      Behave.useSlot("ingress", ingressBody);
      return undefined;
    }

    function Sink(): undefined {
      const receiveBody = Behave.useCallback((...args: readonly unknown[]) => {
        connectedSinkCalls.push([...args]);
      }, []);
      Behave.useSlot("receive", receiveBody);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const relay = Behave.createModel(Relay, undefined);
    const sink = Behave.createModel(Sink, undefined);
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const relayDependency = Behave.usePort(relay);
      const sinkDependency = Behave.usePort(sink);
      Behave.useConnect(sourceDependency.fire, relayDependency.ingress);
      Behave.useConnect(relayDependency.relay, sinkDependency.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
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
    let sourceRef: UntypedModelRef | undefined;
    let destinationRef: UntypedModelRef | undefined;

    function Source(): undefined {
      const fireBody = Behave.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire = Behave.useSignal("fire", fireBody);
      return undefined;
    }

    function Destination(): undefined {
      const firstReceiveBody = Behave.useCallback((_value: string, meta?: ConnectionMeta) => {
        if (meta === undefined) throw new Error("connected metadata is required");
        calls.push({ body: "first", meta });
      }, []);
      Behave.useSlot("receive", firstReceiveBody);
      const secondReceiveBody = Behave.useCallback((_value: string, meta?: ConnectionMeta) => {
        if (meta === undefined) throw new Error("connected metadata is required");
        calls.push({ body: "second", meta });
      }, []);
      Behave.useSlot("receive", secondReceiveBody);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const destination = Behave.createModel(Destination, undefined);
    sourceRef = source;
    destinationRef = destination;
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const destinationDependency = Behave.usePort(destination);
      const sourceEndpoint = sourceDependency.fire;
      const destinationEndpoint = destinationDependency.receive;
      Behave.useConnect(sourceEndpoint, destinationEndpoint);
      Behave.useConnect(sourceEndpoint, destinationEndpoint);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
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

    function Source(): undefined {
      const fire = Behave.useCallback(async (_value: number) => {
        sourceBodyStarted = true;
        await Promise.resolve();
        return "source-result";
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      localSignal = Behave.useSignal("fire", fire);
      return undefined;
    }

    function Destination(): undefined {
      const receive = Behave.useCallback(() => {
        throw failure;
      }, []);
      Behave.useSlot("receive", receive);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const destination = Behave.createModel(Destination, undefined);
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const destinationDependency = Behave.usePort(destination);
      Behave.useConnect(sourceDependency.fire, destinationDependency.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    expect(() => localSignal?.(1)).toThrow(failure);
    expect(sourceBodyStarted).toBe(true);
    root.dispose();
    destination.dispose();
    source.dispose();
  });

  it("surfaces connected async Slot rejections with the original reason", async () => {
    let sourceRef: UntypedModelRef | undefined;
    let nextReason: unknown;

    function Source(): undefined {
      const fireBody = Behave.useCallback((_value: number) => undefined, []);
      Behave.useSignal("fire", fireBody);
      return undefined;
    }

    function Destination(): undefined {
      const receiveBody = Behave.useCallback(() => Promise.reject(nextReason), []);
      Behave.useSlot("receive", receiveBody);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const destination = Behave.createModel(Destination, undefined);
    sourceRef = source;
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const destinationDependency = Behave.usePort(destination);
      Behave.useConnect(sourceDependency.fire, destinationDependency.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    const failure = new Error("connected async Slot failed");
    nextReason = failure;
    expect(await captureUnhandledRejection(() => sourceRef?.fire(1))).toBe(failure);
    nextReason = "connected primitive failure";
    expect(await captureUnhandledRejection(() => sourceRef?.fire(2))).toBe(nextReason);
    root.dispose();
    destination.dispose();
    source.dispose();
  });

  it("surfaces direct async Slot rejections with the original reason", async () => {
    let direct: Slot<readonly [value: number]> | undefined;
    let nextReason: unknown;

    function Destination(): undefined {
      const receiveBody = Behave.useCallback(
        (_value: number) =>
          ({
            then: (_resolve: (value: never) => void, reject: (reason: unknown) => void) => {
              reject(nextReason);
            },
          }),
        [],
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      direct = Behave.useSlot("receive", receiveBody);
      return undefined;
    }

    const root = Behave.createModel(Destination, undefined);
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
    let producerRef: UntypedModelRef | undefined;
    let disconnectFirst: (() => void) | undefined;
    let disconnectSecond: (() => void) | undefined;

    function Producer(): undefined {
      const fire = Behave.useCallback((_value: number) => undefined, []);
      Behave.useSignal("fire", fire);
      return undefined;
    }

    function Consumer(): undefined {
      const receive = Behave.useCallback((value: number) => trace.push(value), []);
      Behave.useSlot("receive", receive);
      return undefined;
    }

    const producer = Behave.createModel(Producer, undefined);
    const consumer = Behave.createModel(Consumer, undefined);
    producerRef = producer;
    function App(): undefined {
      const producerDependency = Behave.usePort(producer);
      const consumerDependency = Behave.usePort(consumer);
      const source = producerDependency.fire;
      const destination = consumerDependency.receive;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disconnectFirst = Behave.useConnect(source, destination);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disconnectSecond = Behave.useConnect(source, destination);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    producerRef?.fire(2);
    expect(trace).toEqual([2, 2]);
    disconnectFirst?.();
    producerRef?.fire(3);
    expect(trace).toEqual([2, 2, 3]);
    expect(() => disconnectFirst?.()).toThrow();
    disconnectSecond?.();
    root.dispose();
    consumer.dispose();
    producer.dispose();
  });

  it("skips a later connection whose destination is disposed during dispatch", () => {
    const trace: string[] = [];
    let sourceRef: UntypedModelRef | undefined;
    let lateRef: UntypedModelRef | undefined;

    function Producer(): undefined {
      const fire = Behave.useCallback((_value: number) => undefined, []);
      Behave.useSignal("fire", fire);
      return undefined;
    }

    function Early(): undefined {
      const receive = Behave.useCallback(() => {
        trace.push("early");
        lateRef?.dispose();
      }, []);
      Behave.useSlot("receive", receive);
      return undefined;
    }

    function Late(): undefined {
      const receive = Behave.useCallback(() => trace.push("late"), []);
      Behave.useSlot("receive", receive);
      return undefined;
    }

    const source = Behave.createModel(Producer, undefined);
    const early = Behave.createModel(Early, undefined);
    const late = Behave.createModel(Late, undefined);
    sourceRef = source;
    lateRef = late;
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const earlyDestination = Behave.usePort(early);
      const lateDestination = Behave.usePort(late);
      const signal = sourceDependency.fire;
      Behave.useConnect(signal, earlyDestination.receive);
      Behave.useConnect(signal, lateDestination.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    sourceRef?.fire(1);
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
    let sourceRef: UntypedModelRef | undefined;

    function SlotOnly(): undefined {
      const body = Behave.useCallback((_value: number) => undefined, []);
      Behave.useSlot("event", body);
      return undefined;
    }

    function Destination(): undefined {
      const body = Behave.useCallback((value: number) => received.push(value), []);
      Behave.useSlot("event", body);
      return undefined;
    }

    const source = Behave.createModel(SlotOnly, undefined);
    const destination = Behave.createModel(Destination, undefined);
    sourceRef = source;
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const destinationDependency = Behave.usePort(destination);
      Behave.useConnect(sourceDependency.event, destinationDependency.event);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    expect(() => sourceRef?.event(5)).toThrow(/no Signal registration/);
    expect(received).toEqual([]);
    expect(warning).toHaveBeenCalled();
    root.dispose();
    destination.dispose();
    source.dispose();
    warning.mockRestore();
  });

  it("warns for a connection destination with no Slot registration and skips delivery", () => {
    interface AmbiguousEndpoints {
      readonly event: Signal<readonly [value: number]> & Slot<readonly [value: number]>;
    }
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const destinationSignalBodies: number[] = [];
    let sourceRef: UntypedModelRef | undefined;

    function Source(): undefined {
      const eventBody = Behave.useCallback((_value: number) => undefined, []);
      Behave.useSignal("event", eventBody);
      return undefined;
    }

    function SignalOnlyDestination(): undefined {
      const eventBody = Behave.useCallback((value: number) => destinationSignalBodies.push(value), []);
      Behave.useSignal("event", eventBody);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const destination = Behave.createModel(SignalOnlyDestination, undefined);
    sourceRef = source;
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const destinationDependency = Behave.usePort(destination);
      Behave.useConnect(sourceDependency.event, destinationDependency.event);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
    sourceRef?.event(5);
    expect(destinationSignalBodies).toEqual([]);
    expect(warning).toHaveBeenCalledWith(
      "Behave connection destination 'event' has no Slot registration",
    );
    root.dispose();
    destination.dispose();
    source.dispose();
    warning.mockRestore();
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

    function Source(): undefined {
      const shared = Behave.useCallback((value: number) => {
        bodies.push(value);
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callback = shared;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signalA = Behave.useSignal("a", shared);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signalB = Behave.useSignal("b", shared);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      ingress = Behave.useSlot("ingress", shared);
      return undefined;
    }

    function Sink(): undefined {
      const receiveABody = Behave.useCallback((value: number) => receivedA.push(value), []);
      Behave.useSlot("receiveA", receiveABody);
      const receiveBBody = Behave.useCallback((value: number) => receivedB.push(value), []);
      Behave.useSlot("receiveB", receiveBBody);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const sink = Behave.createModel(Sink, undefined);
    function App(): undefined {
      const sourceEndpoints = Behave.usePort(source);
      const sinkEndpoints = Behave.usePort(sink);
      Behave.useConnect(sourceEndpoints.a, sinkEndpoints.receiveA);
      Behave.useConnect(sourceEndpoints.b, sinkEndpoints.receiveB);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
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

    function Destination(): undefined {
      const first = Behave.useCallback((value: number, meta?: ConnectionMeta) => {
        traces.push({ body: "first", value, meta });
        return "ignored";
      }, []);
      const second = Behave.useCallback((value: number, meta?: ConnectionMeta) => {
        traces.push({ body: "second", value, meta });
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      plainCallback = first as (value: number) => string;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      direct = Behave.useSlot<readonly [value: number], string>("receive", first);
      Behave.useSlot("receive", second);
      return undefined;
    }

    const root = Behave.createModel(Destination, undefined);
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

  it("keeps same-name Signal and Slot calls role-specific", () => {
    interface BothEndpoints {
      readonly shared: Signal<readonly [value: number]> & Slot<readonly [value: number]>;
    }
    const trace: string[] = [];
    let signal: Signal<readonly [value: number]> | undefined;
    let slot: Slot<readonly [value: number]> | undefined;

    function Both(): undefined {
      const signalBody = Behave.useCallback((value: number) => trace.push(`signal:${value}`), []);
      const slotBody = Behave.useCallback((value: number) => trace.push(`slot:${value}`), []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signal = Behave.useSignal("shared", signalBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slot = Behave.useSlot("shared", slotBody);
      return undefined;
    }

    const root = Behave.createModel(Both, undefined);
    expect(signal?.(1)).toBeUndefined();
    expect(slot?.(2)).toBeUndefined();
    expect(root.shared(3)).toBeUndefined();
    expect(trace).toEqual(["signal:1", "slot:2", "signal:3"]);
    root.dispose();
  });

  it("stops a direct Slot dispatch on the first synchronous body error", () => {
    const failure = new Error("direct slot failed");
    const trace: string[] = [];
    let direct: Slot | undefined;

    function Destination(): undefined {
      const first = Behave.useCallback(() => {
        trace.push("first");
        throw failure;
      }, []);
      const second = Behave.useCallback(() => trace.push("second"), []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      direct = Behave.useSlot("receive", first);
      Behave.useSlot("receive", second);
      return undefined;
    }

    const root = Behave.createModel(Destination, undefined);
    expect(() => direct?.()).toThrow(failure);
    expect(trace).toEqual(["first"]);
    root.dispose();
  });

  it("stops Signal and direct Slot fan-out when an earlier body disposes their owner", () => {
    const signalTrace: string[] = [];
    const slotTrace: string[] = [];
    let signalRoot: UntypedModelRef | undefined;
    let directSlot: Slot | undefined;
    let slotRoot: UntypedModelRef | undefined;

    interface SignalEndpoints {
      readonly fire: Signal;
    }

    function SignalModel(): undefined {
      const first = Behave.useCallback(() => {
        signalTrace.push("first");
        signalRoot?.dispose();
      }, []);
      const second = Behave.useCallback(() => signalTrace.push("second"), []);
      Behave.useSignal("fire", first);
      Behave.useSignal("fire", second);
      return undefined;
    }

    signalRoot = Behave.createModel(SignalModel, undefined);
    expect(() => signalRoot?.fire()).toThrow(/disposed during Signal 'fire' dispatch/);
    expect(signalTrace).toEqual(["first"]);

    function SlotModel(): undefined {
      const first = Behave.useCallback(() => {
        slotTrace.push("first");
        slotRoot?.dispose();
      }, []);
      const second = Behave.useCallback(() => slotTrace.push("second"), []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      directSlot = Behave.useSlot("receive", first);
      Behave.useSlot("receive", second);
      return undefined;
    }

    slotRoot = Behave.createModel(SlotModel, undefined);
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
    let destinationRef: UntypedModelRef | undefined;

    function Source(): undefined {
      const fireBody = Behave.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signal = Behave.useSignal("fire", fireBody);
      return undefined;
    }

    function Destination(): undefined {
      const first = Behave.useCallback(() => {
        trace.push("first");
        destinationRef?.dispose();
      }, []);
      const second = Behave.useCallback(() => trace.push("second"), []);
      Behave.useSlot("receive", first);
      Behave.useSlot("receive", second);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const destination = Behave.createModel(Destination, undefined);
    destinationRef = destination;
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const destinationDependency = Behave.usePort(destination);
      Behave.useConnect(sourceDependency.fire, destinationDependency.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
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

    function Source(): undefined {
      const fireBody = Behave.useCallback(() => undefined, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signal = Behave.useSignal("fire", fireBody);
      return undefined;
    }

    function Early(): undefined {
      const receiveBody = Behave.useCallback(() => {
        trace.push("early");
        throw failure;
      }, []);
      Behave.useSlot("receive", receiveBody);
      return undefined;
    }

    function Late(): undefined {
      const receiveBody = Behave.useCallback(() => trace.push("late"), []);
      Behave.useSlot("receive", receiveBody);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const early = Behave.createModel(Early, undefined);
    const late = Behave.createModel(Late, undefined);
    function App(): undefined {
      const sourceDependency = Behave.usePort(source);
      const earlyDestination = Behave.usePort(early);
      const lateDestination = Behave.usePort(late);
      const sourceEndpoint = sourceDependency.fire;
      Behave.useConnect(sourceEndpoint, earlyDestination.receive);
      Behave.useConnect(sourceEndpoint, lateDestination.receive);
      return undefined;
    }

    const root = Behave.createModel(App, undefined);
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

    function Allowed(): undefined {
      const fireBody = Behave.useCallback(() => trace.push("signal"), []);
      const signal = Behave.useSignal("fire", fireBody);
      const receiveBody = Behave.useCallback(() => trace.push("slot"), []);
      const slot = Behave.useSlot("receive", receiveBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      invoke = Behave.useCallback(() => {
        signal();
        slot();
        trace.push("callback-end");
      }, [signal, slot]);
      Behave.useEffect(() => {
        signal();
        slot();
        trace.push("effect-end");
      }, [signal, slot]);
      return undefined;
    }

    const root = Behave.createModel(Allowed, undefined);
    expect(trace).toEqual(["signal", "slot", "effect-end"]);
    expect(warning).not.toHaveBeenCalled();
    invoke?.();
    expect(trace).toEqual(["signal", "slot", "effect-end", "signal", "slot", "callback-end"]);
    expect(warning).not.toHaveBeenCalled();
    root.dispose();

    function EvaluationSignal(): undefined {
      const fireBody = Behave.useCallback(() => trace.push("evaluation-signal"), []);
      const signal = Behave.useSignal("fire", fireBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      const immediate = Behave.useCallback(() => signal(), [signal]);
      immediate();
      return undefined;
    }
    const signalRoot = Behave.createModel(EvaluationSignal, undefined);
    expect(trace.at(-1)).toBe("evaluation-signal");
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(
      /Model#\d+ called Signal 'fire' on Model#\d+ while evaluating.*Behave\.useEffect.*managed callback/,
    ));

    function EvaluationSlot(): undefined {
      const receiveBody = Behave.useCallback(() => trace.push("evaluation-slot"), []);
      const slot = Behave.useSlot("receive", receiveBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slot();
      return undefined;
    }
    const slotRoot = Behave.createModel(EvaluationSlot, undefined);
    expect(trace.at(-1)).toBe("evaluation-slot");
    expect(warning).toHaveBeenCalledWith(expect.stringMatching(
      /Model#\d+ called Slot 'receive' on Model#\d+ while evaluating.*Behave\.useEffect.*managed callback/,
    ));
    signalRoot.dispose();
    slotRoot.dispose();
    warning.mockRestore();
  });

  it("uses the current endpoint candidate and committed connection graph during evaluation dispatch", async () => {
    const trace: string[] = [];
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    function Source(): undefined {
      const [value, setValue] = Behave.useState(0);
      const advance = Behave.useCallback(() => setValue(1), [setValue]);
      Behave.useSignal("advance", advance);
      const fireBody = Behave.useCallback((next: number) => trace.push(`body:${next}:${value}`), [value]);
      const fire = Behave.useSignal("fire", fireBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire(value);
      return undefined;
    }
    function Destination(): undefined {
      const receive = Behave.useCallback((value: number) => trace.push(`slot:${value}`), []);
      Behave.useSlot("receive", receive);
      return undefined;
    }

    const source = Behave.createModel(Source, undefined);
    const destination = Behave.createModel(Destination, undefined);
    function Connector(): undefined {
      const sourceDependency = Behave.usePort(source);
      const destinationDependency = Behave.usePort(destination);
      Behave.useConnect(sourceDependency.fire, destinationDependency.receive);
      return undefined;
    }
    const connector = Behave.createModel(Connector, undefined);
    trace.length = 0;
    source.advance();
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
    function Target(): undefined {
      const fireBody = Behave.useCallback((source: string) => trace.push(source), []);
      Behave.useSignal("fire", fireBody);
      return undefined;
    }
    const target = Behave.createModel(Target, undefined);

    function PublicCaller(): undefined {
      // test-only probe -- runtime-known public-ref dispatch is invalid authoring during evaluation
      target.fire("public");
      return undefined;
    }
    function DependencyCaller(): undefined {
      const dependency = Behave.usePort(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      dependency.fire("dependency");
      return undefined;
    }

    const publicCaller = Behave.createModel(PublicCaller, undefined);
    const dependencyCaller = Behave.createModel(DependencyCaller, undefined);
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
    function Retrying(): undefined {
      const [value, setValue] = Behave.useState(0);
      const first = Behave.useCallback(() => trace.push(`first:${value}`), [value]);
      const fire = Behave.useSignal("fire", first);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire();
      if (value === 0) setValue(1);
      return undefined;
    }
    const retrying = Behave.createModel(Retrying, undefined);
    expect(trace).toEqual(["first:0", "first:1"]);
    expect(warning).toHaveBeenCalledTimes(1);
    retrying.dispose();

    const failure = new Error("evaluation signal failed");
    function Broken(): never {
      const first = Behave.useCallback(() => {
        trace.push("throw");
        throw failure;
      }, []);
      const second = Behave.useCallback(() => trace.push("later"), []);
      const fire = Behave.useSignal("fire", first);
      Behave.useSignal("fire", second);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fire();
      throw new Error("unreachable");
    }
    expect(() => Behave.createModel(Broken, undefined)).toThrow(failure);
    expect(trace.slice(-1)).toEqual(["throw"]);
    warning.mockRestore();
  });

  it("attributes an evaluation-time external dispatch failure to the evaluator and keeps the target live", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failure = new Error("external evaluation dispatch failed");
    const trace: string[] = [];
    function Target(): undefined {
      const first = Behave.useCallback(() => {
        trace.push("first");
        throw failure;
      }, []);
      const second = Behave.useCallback(() => trace.push("second"), []);
      Behave.useSignal("fire", first);
      Behave.useSignal("fire", second);
      return undefined;
    }
    const target = Behave.createModel(Target, undefined);
    function Caller(): undefined {
      const dependency = Behave.usePort(target);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      dependency.fire();
      return undefined;
    }

    expect(() => Behave.createModel(Caller, undefined)).toThrow(failure);
    expect(() => Behave.getInterface(target)).not.toThrow();
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
    let sourceRef: UntypedModelRef | null = null;

    function Source(): undefined {
      const fireBody = Behave.useCallback((_value: number) => undefined, []);
      Behave.useSignal("fire", fireBody);
      return undefined;
    }
    function Destination(id: number): undefined {
      const receiveBody = Behave.useCallback((_value: number) => deliveries.push(id), [id]);
      Behave.useSlot("receive", receiveBody);
      return undefined;
    }
    const source = Behave.createModel(Source, undefined);
    const first = Behave.createModel(Destination, 1);
    const second = Behave.createModel(Destination, 2);
    function Parent(): undefined {
      const [target, setTarget] = Behave.useState(1);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      sourceRef = source;
      const sourceDependency = Behave.usePort(source);
      const destinationDependency = Behave.usePort(target === 1 ? first : second);
      const disconnect = Behave.useConnect(sourceDependency.fire, destinationDependency.receive);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disconnects.push(disconnect);
      const retarget = Behave.useCallback(() => setTarget(2), [setTarget]);
      Behave.useSignal("retarget", retarget);
      return undefined;
    }

    const root = Behave.createModel(Parent, undefined);
    (sourceRef as UntypedModelRef | null)?.fire(1);
    expect(deliveries).toEqual([1]);
    root.retarget();
    await waitFor(() => disconnects.length === 2);
    expect(disconnects[1]).toBe(disconnects[0]);
    (sourceRef as UntypedModelRef | null)?.fire(2);
    expect(deliveries).toEqual([1, 2]);
    root.dispose();
    second.dispose();
    first.dispose();
    source.dispose();
  });
});
