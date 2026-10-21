import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { Signal, Slot, StateSetter } from "behavon";
import { waitFor, signalOf } from "../helpers";

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function captureScheduledFailure(trigger: () => void): Promise<unknown> {
  const originalSetTimeout = globalThis.setTimeout;
  let surfaced: unknown;
  globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
    try {
      if (typeof handler === "function") handler();
    } catch (error: unknown) {
      surfaced = error;
    }
    return originalSetTimeout(() => undefined, 0);
  }) as typeof setTimeout;
  try {
    trigger();
    await Promise.resolve();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  return surfaced;
}

describe("useCallback React identity and closure semantics", () => {
  it("uses the supplied function as the Proxy target for reflection and construction", () => {
    let managedConstructor: Function | undefined;
    let managedArrow: Function | undefined;
    const observedNewTargets: Array<Function | undefined> = [];
    const prototype = { marker: "prototype" };
    function Supplied(this: { value?: number }, value: number, _unused: number): number {
      observedNewTargets.push(new.target);
      this.value = value;
      return value;
    }
    Supplied.prototype = prototype;
    Object.defineProperty(Supplied, "custom", {
      value: 42,
      enumerable: true,
      configurable: true,
      writable: false,
    });
    const arrow = (value: number): number => value + 1;

    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      managedConstructor = Behavon.useCallback(Supplied, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      managedArrow = Behavon.useCallback(arrow, []);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    try {
      expect(managedConstructor).not.toBe(Supplied);
      expect(managedConstructor?.name).toBe(Supplied.name);
      expect(managedConstructor?.length).toBe(Supplied.length);
      expect(Object.getPrototypeOf(managedConstructor)).toBe(Object.getPrototypeOf(Supplied));
      expect(Object.getOwnPropertyDescriptor(managedConstructor as Function, "custom"))
        .toEqual(Object.getOwnPropertyDescriptor(Supplied, "custom"));
      expect((managedConstructor as typeof Supplied).prototype).toBe(prototype);
      const instance = Reflect.construct(managedConstructor as Function, [7, 0]) as { value: number };
      expect(instance.value).toBe(7);
      expect(Object.getPrototypeOf(instance)).toBe(prototype);
      expect(observedNewTargets).toEqual([managedConstructor]);

      const alternatePrototype = { marker: "alternate" };
      function Alternate(): void {}
      Alternate.prototype = alternatePrototype;
      const alternate = Reflect.construct(
        managedConstructor as Function,
        [8, 0],
        Alternate,
      ) as { value: number };
      expect(alternate.value).toBe(8);
      expect(Object.getPrototypeOf(alternate)).toBe(alternatePrototype);
      expect(observedNewTargets).toEqual([managedConstructor, Alternate]);
      expect(() => Reflect.construct(managedArrow as Function, [1])).toThrow(TypeError);
    } finally {
      root.dispose();
    }
  });

  it("preserves Hook-free generator protocols for retained invocation after dispose", async () => {
    function* suppliedSync(seed: number): Generator<string, number, boolean> {
      const advance = yield `sync:${seed}`;
      return advance ? seed + 1 : seed - 1;
    }

    async function* suppliedAsync(seed: number): AsyncGenerator<string, number, boolean> {
      const advance = yield `async:${seed}`;
      return advance ? seed + 1 : seed - 1;
    }

    let managedSync: typeof suppliedSync | undefined;
    let managedAsync: typeof suppliedAsync | undefined;

    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a valid generator-shaped Hook result
      managedSync = Behavon.useCallback(suppliedSync, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a valid async-generator-shaped Hook result
      managedAsync = Behavon.useCallback(suppliedAsync, []);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    const retainedSync = managedSync as typeof suppliedSync;
    const retainedAsync = managedAsync as typeof suppliedAsync;
    root.dispose();

    const syncIterator = retainedSync(4);
    expect(syncIterator[Symbol.iterator]()).toBe(syncIterator);
    expect(syncIterator.next()).toEqual({ value: "sync:4", done: false });
    expect(syncIterator.next(true)).toEqual({ value: 5, done: true });

    const asyncIterator = retainedAsync(8);
    expect(asyncIterator[Symbol.asyncIterator]()).toBe(asyncIterator);
    await expect(asyncIterator.next()).resolves.toEqual({ value: "async:8", done: false });
    await expect(asyncIterator.next(false)).resolves.toEqual({ value: 7, done: true });
  });

  it("constructs a class through its preserved constructor-only public type", () => {
    class Constructed {
      constructor(readonly value: number) {}
    }

    let managed: typeof Constructed | undefined;
    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the constructor-shaped Hook result
      managed = Behavon.useCallback(Constructed, []);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    try {
      if (managed === undefined) throw new Error("managed constructor was not evaluated");
      const instance: Constructed = new managed(42);
      expect(instance).toBeInstanceOf(Constructed);
      expect(instance.value).toBe(42);
    } finally {
      root.dispose();
    }
  });

  it("keeps construct invocation inside the managed Hook/error boundary", () => {
    const constructorFailure = new Error("constructor failed");
    let throwingConstructor: Function | undefined;

    function Throwing(): never {
      throw constructorFailure;
    }

    function ThrowingModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      throwingConstructor = Behavon.useCallback(Throwing, []);
      return undefined;
    }

    const root = Behavon.createModel(ThrowingModel, undefined);
    expect(() => Reflect.construct(throwingConstructor as Function, [])).toThrow(constructorFailure);
    root.dispose();

    function Hooking(): void {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime guard probe intentionally discards the state handle
      Behavon.useState(0);
    }

    function HookGuardModel(): undefined {
      const managed = Behavon.useCallback(Hooking, []);
      Reflect.construct(managed, []);
      return undefined;
    }

    expect(() => Behavon.createModel(HookGuardModel, undefined)).toThrow(
      /useState cannot be called inside managed callback body/,
    );
  });

  it("brands only the managed Proxy for endpoint provenance, not its supplied target", () => {
    interface Endpoints { readonly invoke: Signal }
    const trace: string[] = [];
    const supplied = (): void => {
      trace.push("invoked");
    };

    type ValidPortType = { "invoke": PortOnlySignal<any> };
    const validPort = Behavon.createPort<ValidPortType>({ "invoke": Behavon.SignalType() });
    function Valid(): undefined {
      const managed = Behavon.useCallback(supplied, []);
      Behavon.useSignal(validPort, "invoke", managed);
      Behavon.useExport(validPort, "invoke");
      return undefined;
    }

    const root = Behavon.createModel((Valid as unknown as Model<any, any, ValidPortType>), undefined);
    signalOf(root, "invoke")();
    expect(trace).toEqual(["invoked"]);
    root.dispose();

    type InvalidPortType = { "invoke": PortOnlySignal<any> };
    const invalidPort = Behavon.createPort<InvalidPortType>({ "invoke": Behavon.SignalType() });
    function Invalid(): undefined {
      Behavon.useSignal(invalidPort, "invoke", supplied);
      Behavon.useExport(invalidPort, "invoke");
      return undefined;
    }

    expect(() => Behavon.createModel((Invalid as unknown as Model<any, any, InvalidPortType>), undefined)).toThrow(
      /useSignal requires a managed callback from the same Model/,
    );
  });

  it("preserves the JavaScript receiver for method, call, and apply invocation", () => {
    let callback: ((increment: number) => number) | undefined;
    const receivers: unknown[] = [];

    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callback = Behavon.useCallback(function (this: { readonly base: number }, increment: number) {
        receivers.push(this);
        return this.base + increment;
      }, []);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    const managed = callback as (increment: number) => number;
    const methodReceiver = { base: 40, managed };
    const callReceiver = { base: 10 };
    const applyReceiver = { base: 7 };

    try {
      expect(methodReceiver.managed(2)).toBe(42);
      expect(managed.call(callReceiver, 5)).toBe(15);
      expect(managed.apply(applyReceiver, [3])).toBe(10);
      expect(receivers).toHaveLength(3);
      expect(receivers[0]).toBe(methodReceiver);
      expect(receivers[1]).toBe(callReceiver);
      expect(receivers[2]).toBe(applyReceiver);
    } finally {
      root.dispose();
    }
  });

  it("A B F compares fixed dependencies with Object.is and preserves each version closure", async () => {
    interface Endpoints {
      readonly setDependency: Signal<readonly [value: number]>;
      readonly tick: Signal;
    }
    const callbacks: Array<() => string> = [];
    const derivedCallbacks: Array<() => string> = [];
    const evaluationCalls: string[][] = [];
    let memoRuns = 0;
    const effects: string[] = [];

    type ModelPortType = { "setDependency": PortOnlySignal<any>; "tick": PortOnlySignal<any> };
    const modelPort = Behavon.createPort<ModelPortType>({ "setDependency": Behavon.SignalType(), "tick": Behavon.SignalType() });
    function Model(): undefined {
      const [dependency, setDependency] = Behavon.useState(Number.NaN);
      const [epoch, setEpoch] = Behavon.useState(0);
      const previous = callbacks.at(-1);
      const callback = Behavon.useCallback(
        () => `${Object.is(dependency, -0) ? "-0" : String(dependency)}:${epoch}`,
        // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only stale-closure probe intentionally changes epoch outside the declared dependency
        [dependency],
      );
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(callback);
      const evaluationCall: string[] = [];
      if (previous !== undefined) evaluationCall.push(previous(), callback());
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      evaluationCalls.push(evaluationCall);
      const memo = Behavon.useMemo(() => {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        memoRuns += 1;
        return callback;
      }, [callback]);
      const derived = Behavon.useCallback(() => memo(), [memo]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      derivedCallbacks.push(derived);
      Behavon.useEffect(() => {
        const effectValue = callback();
        effects.push(`setup:${effectValue}`);
        return () => effects.push(`cleanup:${effectValue}`);
      }, [callback]);
      const setDependencyBody = Behavon.useCallback((value: number) => setDependency(value), [setDependency]);
      const tickBody = Behavon.useCallback(() => setEpoch((value) => value + 1), [setEpoch]);
      Behavon.useSignal(modelPort, "setDependency", setDependencyBody);
      Behavon.useExport(modelPort, "setDependency");
      Behavon.useSignal(modelPort, "tick", tickBody);
      Behavon.useExport(modelPort, "tick");
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPortType>), undefined);
    const initial = callbacks[0];
    const initialDerived = derivedCallbacks[0];
    expect(initial()).toBe("NaN:0");

    signalOf(root, "tick")();
    await waitFor(() => callbacks.length === 2);
    expect(callbacks[1]).toBe(initial);
    expect(callbacks[1]()).toBe("NaN:0");
    expect(derivedCallbacks[1]).toBe(initialDerived);
    expect(memoRuns).toBe(1);
    expect(effects).toEqual(["setup:NaN:0"]);

    signalOf(root, "setDependency")(-0);
    await waitFor(() => callbacks.length === 3);
    const negativeZero = callbacks[2];
    expect(negativeZero).not.toBe(initial);
    expect(initial()).toBe("NaN:0");
    expect(negativeZero()).toBe("-0:1");
    expect(evaluationCalls[2]).toEqual(["NaN:0", "-0:1"]);
    expect(derivedCallbacks[2]).not.toBe(initialDerived);
    expect(memoRuns).toBe(2);
    expect(effects).toEqual([
      "setup:NaN:0",
      "cleanup:NaN:0",
      "setup:-0:1",
    ]);

    signalOf(root, "setDependency")(+0);
    await waitFor(() => callbacks.length === 4);
    const positiveZero = callbacks[3];
    expect(positiveZero).not.toBe(negativeZero);
    expect(positiveZero()).toBe("0:1");

    signalOf(root, "tick")();
    await waitFor(() => callbacks.length === 5);
    expect(callbacks[4]).toBe(positiveZero);
    expect(callbacks[4]()).toBe("0:1");
    root.dispose();
  });

  it("C keeps endpoint and connection handles stable while dispatching only latest committed versions", async () => {
    interface Endpoints {
      readonly advance: Signal;
      readonly fire: Signal;
    }
    const signalBodies: Array<() => void> = [];
    const slotBodies: Array<() => void> = [];
    const fireHandles: Signal[] = [];
    const slotHandles: Slot[] = [];
    const disconnects: Array<() => void> = [];
    const trace: string[] = [];

    type ModelPort1Type = { "advance": PortOnlySignal<any>; "fire": PortOnlySignal<any>; "receive": PortOnlySlot<any> };
    const modelPort1 = Behavon.createPort<ModelPort1Type>({ "advance": Behavon.SignalType(), "fire": Behavon.SignalType(), "receive": Behavon.SlotType() });
    function Model(): undefined {
      const [version, setVersion] = Behavon.useState(0);
      const advanceBody = Behavon.useCallback(() => setVersion((value) => value + 1), [setVersion]);
      const signalBody = Behavon.useCallback(() => trace.push(`signal:${version}`), [version]);
      const slotBody = Behavon.useCallback(() => trace.push(`slot:${version}`), [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signalBodies.push(signalBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slotBodies.push(slotBody);
      Behavon.useSignal(modelPort1, "advance", advanceBody);
      Behavon.useExport(modelPort1, "advance");
      const fire = Behavon.useSignal(modelPort1, "fire", signalBody);
      Behavon.useExport(modelPort1, "fire");
      const receive = Behavon.useSlot(modelPort1, "receive", slotBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fireHandles.push(fire);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slotHandles.push(receive);
      const disconnect = Behavon.useConnect(fire, receive);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disconnects.push(disconnect);
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort1Type>), undefined);
    const firstSignalBody = signalBodies[0];
    const firstSlotBody = slotBodies[0];
    signalOf(root, "fire")();
    slotHandles[0]();
    expect(trace).toEqual(["signal:0", "slot:0", "slot:0"]);

    trace.length = 0;
    signalOf(root, "advance")();
    await waitFor(() => signalBodies.length === 2);
    expect(fireHandles[1]).toBe(fireHandles[0]);
    expect(slotHandles[1]).toBe(slotHandles[0]);
    expect(disconnects[1]).toBe(disconnects[0]);
    expect(signalBodies[1]).not.toBe(firstSignalBody);
    expect(slotBodies[1]).not.toBe(firstSlotBody);
    signalOf(root, "fire")();
    slotHandles[1]();
    expect(trace).toEqual(["signal:1", "slot:1", "slot:1"]);

    trace.length = 0;
    firstSignalBody();
    firstSlotBody();
    expect(trace).toEqual(["signal:0", "slot:0"]);
    root.dispose();
  });

  it("D keeps candidate and committed ordinary callbacks callable after terminal evaluation failure", async () => {
    interface Endpoints {
      readonly advance: Signal;
      readonly inspect: Signal;
    }
    const failure = new Error("candidate evaluation failed");
    const callbacks: Array<() => number> = [];
    const endpointResults: number[] = [];
    let shouldThrow = false;

    type ModelPort2Type = { "advance": PortOnlySignal<any>; "inspect": PortOnlySignal<any> };
    const modelPort2 = Behavon.createPort<ModelPort2Type>({ "advance": Behavon.SignalType(), "inspect": Behavon.SignalType() });
    function Model(): undefined {
      const [version, setVersion] = Behavon.useState(0);
      const inspect = Behavon.useCallback(() => version, [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(inspect);
      const advance = Behavon.useCallback(() => setVersion(1), [setVersion]);
      Behavon.useSignal(modelPort2, "advance", advance);
      Behavon.useExport(modelPort2, "advance");
      const inspectEndpoint = Behavon.useCallback(() => endpointResults.push(version), [version]);
      Behavon.useSignal(modelPort2, "inspect", inspectEndpoint);
      Behavon.useExport(modelPort2, "inspect");
      if (version === 1 && shouldThrow) throw failure;
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort2Type>), undefined);
    const committed = callbacks[0];
    signalOf(root, "inspect")();
    shouldThrow = true;
    expect(await captureScheduledFailure(() => signalOf(root, "advance")())).toBe(failure);
    const aborted = callbacks[1];
    expect(aborted).not.toBe(committed);
    expect(committed()).toBe(0);
    expect(aborted()).toBe(1);
    expect(endpointResults).toEqual([0]);
    expect(() => Behavon.getInterface(root)).toThrow(/disposed/);
    expect(committed()).toBe(0);
    expect(aborted()).toBe(1);
  });

  it("D keeps a callback retained from failed construction callable", () => {
    const failure = new Error("construction failed");
    let candidate: (() => string) | undefined;

    function Broken(): never {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      candidate = Behavon.useCallback(() => "candidate", []);
      throw failure;
    }

    expect(() => Behavon.createModel(Broken, undefined)).toThrow(failure);
    expect(candidate?.()).toBe("candidate");
  });

  it("E leaves a callback and endpoint candidate from a same-value bailout inactive", async () => {
    interface Endpoints {
      readonly speculate: Signal;
      readonly inspect: Signal;
    }
    let phase = 0;
    const callbacks: Array<() => number> = [];
    const endpointResults: number[] = [];

    type ModelPort3Type = { "inspect": PortOnlySignal<any>; "speculate": PortOnlySignal<any> };
    const modelPort3 = Behavon.createPort<ModelPort3Type>({ "inspect": Behavon.SignalType(), "speculate": Behavon.SignalType() });
    function Model(): undefined {
      const [, setValue] = Behavon.useState(0);
      const renderedPhase = phase;
      const inspect = Behavon.useCallback(() => renderedPhase, [renderedPhase]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(inspect);
      const inspectEndpoint = Behavon.useCallback(() => endpointResults.push(renderedPhase), [renderedPhase]);
      Behavon.useSignal(modelPort3, "inspect", inspectEndpoint);
      Behavon.useExport(modelPort3, "inspect");
      const speculate = Behavon.useCallback(() => setValue((previous) => {
        phase = 1;
        return previous;
      }), [setValue]);
      Behavon.useSignal(modelPort3, "speculate", speculate);
      Behavon.useExport(modelPort3, "speculate");
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort3Type>), undefined);
    signalOf(root, "speculate")();
    await settle();
    expect(callbacks).toHaveLength(2);
    expect(callbacks[1]).not.toBe(callbacks[0]);
    expect(callbacks[0]()).toBe(0);
    expect(callbacks[1]()).toBe(1);
    signalOf(root, "inspect")();
    expect(endpointResults).toEqual([0]);
    root.dispose();
    expect(callbacks[0]()).toBe(0);
    expect(callbacks[1]()).toBe(1);
  });

  it("G keeps ordinary callback versions callable while stable endpoint handles become terminal on dispose", async () => {
    interface Endpoints {
      readonly advance: Signal;
      readonly inspect: Signal;
    }
    const callbacks: Array<() => number> = [];
    const handles: Signal[] = [];
    let setter: StateSetter<number> | undefined;

    type ModelPort4Type = { "advance": PortOnlySignal<any>; "inspect": PortOnlySignal<any> };
    const modelPort4 = Behavon.createPort<ModelPort4Type>({ "advance": Behavon.SignalType(), "inspect": Behavon.SignalType() });
    function Model(): undefined {
      const [version, setVersion] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setter = setVersion;
      const inspect = Behavon.useCallback(() => version, [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(inspect);
      const advance = Behavon.useCallback(() => setVersion(1), [setVersion]);
      Behavon.useSignal(modelPort4, "advance", advance);
      Behavon.useExport(modelPort4, "advance");
      const inspectHandle = Behavon.useSignal(modelPort4, "inspect", inspect);
      Behavon.useExport(modelPort4, "inspect");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      handles.push(inspectHandle);
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort4Type>), undefined);
    signalOf(root, "advance")();
    await waitFor(() => callbacks.length === 2);
    expect(handles[1]).toBe(handles[0]);
    root.dispose();
    expect(callbacks[0]()).toBe(0);
    expect(callbacks[1]()).toBe(1);
    expect(() => handles[0]()).toThrow(/disposed during Signal 'inspect' dispatch/);
    expect(() => setter?.(2)).not.toThrow();
  });

  it("G preserves receiver and separates captured operation lifecycle after dispose", () => {
    interface Endpoints {
      readonly inspect: Signal;
    }
    const trace: string[] = [];
    const failure = new Error("retained callback failed");
    let ordinary: ((this: { readonly label: string }) => string) | undefined;
    let throwing: (() => never) | undefined;
    let invokeSetter: (() => string) | undefined;
    let invokeEndpoint: (() => string) | undefined;
    let setter: StateSetter<number> | undefined;
    let endpoint: Signal | undefined;

    type ModelPort5Type = { "inspect": PortOnlySignal<any> };
    const modelPort5 = Behavon.createPort<ModelPort5Type>({ "inspect": Behavon.SignalType() });
    function Model(): undefined {
      const [, setValue] = Behavon.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setter = setValue;
      const inspect = Behavon.useCallback(() => trace.push("endpoint"), []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      endpoint = Behavon.useSignal(modelPort5, "inspect", inspect);
      Behavon.useExport(modelPort5, "inspect");
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      ordinary = Behavon.useCallback(function (this: { readonly label: string }) {
        trace.push(`ordinary:${this.label}`);
        return this.label;
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      throwing = Behavon.useCallback(() => {
        throw failure;
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      invokeSetter = Behavon.useCallback(() => {
        trace.push("setter-body");
        setter?.(1);
        return "setter-return";
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only retained-callback probe observes an outer mutable capability after disposal
      }, [setter]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      invokeEndpoint = Behavon.useCallback(() => {
        trace.push("endpoint-body");
        endpoint?.();
        return "unreachable";
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only retained-callback probe observes an outer mutable capability after disposal
      }, [endpoint]);
      return undefined;
    }

    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort5Type>), undefined);
    const retainedOrdinary = ordinary as (this: { readonly label: string }) => string;
    const retainedThrowing = throwing as () => never;
    const retainedSetterCallback = invokeSetter as () => string;
    const retainedEndpointCallback = invokeEndpoint as () => string;
    root.dispose();

    expect(retainedOrdinary.call({ label: "retained" })).toBe("retained");
    expect(retainedOrdinary.apply({ label: "applied" }, [])).toBe("applied");
    expect(() => retainedThrowing()).toThrow(failure);
    expect(retainedSetterCallback()).toBe("setter-return");
    expect(() => retainedEndpointCallback()).toThrow(/disposed during Signal 'inspect' dispatch/);
    expect(trace).toEqual(["ordinary:retained", "ordinary:applied", "setter-body", "endpoint-body"]);
  });

  it("H rejects ordinary and cross-owner functions but permits an explicitly retained same-owner version", async () => {
    let foreign: (() => void) | undefined;
    function Owner(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      foreign = Behavon.useCallback(() => undefined, []);
      return undefined;
    }
    const owner = Behavon.createModel(Owner, undefined);

    type OrdinaryPortType = { "ordinary": PortOnlySignal<any> };
    const ordinaryPort = Behavon.createPort<OrdinaryPortType>({ "ordinary": Behavon.SignalType() });
    function Ordinary(): undefined {
      Behavon.useSignal(ordinaryPort, "ordinary", () => undefined);
      Behavon.useExport(ordinaryPort, "ordinary");
      return undefined;
    }
    type CrossOwnerPortType = { "foreign": PortOnlySignal<any> };
    const crossOwnerPort = Behavon.createPort<CrossOwnerPortType>({ "foreign": Behavon.SignalType() });
    function CrossOwner(): undefined {
      Behavon.useSignal(crossOwnerPort, "foreign", foreign as () => void);
      Behavon.useExport(crossOwnerPort, "foreign");
      return undefined;
    }
    expect(() => Behavon.createModel((Ordinary as unknown as Model<any, any, OrdinaryPortType>), undefined)).toThrow(/managed callback from the same Model/);
    expect(() => Behavon.createModel((CrossOwner as unknown as Model<any, any, CrossOwnerPortType>), undefined)).toThrow(/managed callback from the same Model/);
    owner.dispose();

    interface Endpoints {
      readonly advance: Signal;
      readonly retained: Signal;
      readonly current: Signal;
    }
    const trace: number[] = [];
    let retained: (() => void) | undefined;
    type ModelPort6Type = { "advance": PortOnlySignal<any>; "retained": PortOnlySignal<any>; "current": PortOnlySignal<any> };
    const modelPort6 = Behavon.createPort<ModelPort6Type>({ "advance": Behavon.SignalType(), "retained": Behavon.SignalType(), "current": Behavon.SignalType() });
    function Model(): undefined {
      const [version, setVersion] = Behavon.useState(0);
      const current = Behavon.useCallback(() => trace.push(version), [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      retained ??= current;
      const advance = Behavon.useCallback(() => setVersion(1), [setVersion]);
      Behavon.useSignal(modelPort6, "advance", advance);
      Behavon.useExport(modelPort6, "advance");
      Behavon.useSignal(modelPort6, "retained", retained);
      Behavon.useExport(modelPort6, "retained");
      Behavon.useSignal(modelPort6, "current", current);
      Behavon.useExport(modelPort6, "current");
      return undefined;
    }
    const root = Behavon.createModel((Model as unknown as Model<any, any, ModelPort6Type>), undefined);
    signalOf(root, "advance")();
    await settle();
    signalOf(root, "retained")();
    signalOf(root, "current")();
    expect(trace).toEqual([0, 1]);
    root.dispose();
  });

  it("H preserves multi-name, multi-role, and multi-registration cardinality across version changes", async () => {
    interface Endpoints {
      readonly advance: Signal;
      readonly first: Signal;
      readonly second: Signal;
      readonly firstSlot: Slot;
    }
    const endpointsPort = Behavon.createPort<Endpoints>({
      advance: Behavon.SignalType(),
      first: Behavon.SignalType(),
      second: Behavon.SignalType(),
      firstSlot: Behavon.SlotType(),
    });
    const callbacks: Array<() => void> = [];
    const slotHandles: Slot[] = [];
    const trace: number[] = [];

    function Model(): undefined {
      const [version, setVersion] = Behavon.useState(0);
      const shared = Behavon.useCallback(() => trace.push(version), [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(shared);
      const advance = Behavon.useCallback(() => setVersion(1), [setVersion]);
      Behavon.useSignal(endpointsPort, "advance", advance);
      Behavon.useExport(endpointsPort, "advance");
      Behavon.useSignal(endpointsPort, "first", shared);
      Behavon.useSignal(endpointsPort, "first", shared);
      Behavon.useExport(endpointsPort, "first");
      Behavon.useSignal(endpointsPort, "second", shared);
      Behavon.useExport(endpointsPort, "second");
      // A Port member is either a Signal or a Slot, so the Slot sharing the callback has its own name.
      const firstSlot = Behavon.useSlot(endpointsPort, "firstSlot", shared);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slotHandles.push(firstSlot);
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    signalOf(root, "first")();
    signalOf(root, "second")();
    slotHandles[0]();
    expect(trace).toEqual([0, 0, 0, 0]);

    trace.length = 0;
    signalOf(root, "advance")();
    await settle();
    signalOf(root, "first")();
    signalOf(root, "second")();
    slotHandles[1]();
    expect(trace).toEqual([1, 1, 1, 1]);
    callbacks[0]();
    expect(trace.at(-1)).toBe(0);
    root.dispose();
  });
});
