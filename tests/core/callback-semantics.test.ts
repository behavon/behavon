import { describe, expect, it } from "vitest";
import Behave from "behavon";
import type { Signal, Slot, StateSetter } from "behavon";
import { waitFor } from "../helpers";

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
      managedConstructor = Behave.useCallback(Supplied, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      managedArrow = Behave.useCallback(arrow, []);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
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
      managedSync = Behave.useCallback(suppliedSync, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a valid async-generator-shaped Hook result
      managedAsync = Behave.useCallback(suppliedAsync, []);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
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
      managed = Behave.useCallback(Constructed, []);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
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
      throwingConstructor = Behave.useCallback(Throwing, []);
      return undefined;
    }

    const root = Behave.createModel(ThrowingModel, undefined);
    expect(() => Reflect.construct(throwingConstructor as Function, [])).toThrow(constructorFailure);
    root.dispose();

    function Hooking(): void {
      // eslint-disable-next-line behavon-hooks/canonical-api -- runtime guard probe intentionally discards the state handle
      Behave.useState(0);
    }

    function HookGuardModel(): undefined {
      const managed = Behave.useCallback(Hooking, []);
      Reflect.construct(managed, []);
      return undefined;
    }

    expect(() => Behave.createModel(HookGuardModel, undefined)).toThrow(
      /useState cannot be called inside managed callback body/,
    );
  });

  it("brands only the managed Proxy for endpoint provenance, not its supplied target", () => {
    interface Endpoints { readonly invoke: Signal }
    const trace: string[] = [];
    const supplied = (): void => {
      trace.push("invoked");
    };

    function Valid(): undefined {
      const managed = Behave.useCallback(supplied, []);
      Behave.useSignal("invoke", managed);
      return undefined;
    }

    const root = Behave.createModel(Valid, undefined);
    root.invoke();
    expect(trace).toEqual(["invoked"]);
    root.dispose();

    function Invalid(): undefined {
      Behave.useSignal("invoke", supplied);
      return undefined;
    }

    expect(() => Behave.createModel(Invalid, undefined)).toThrow(
      /useSignal requires a managed callback from the same Model/,
    );
  });

  it("preserves the JavaScript receiver for method, call, and apply invocation", () => {
    let callback: ((increment: number) => number) | undefined;
    const receivers: unknown[] = [];

    function Model(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callback = Behave.useCallback(function (this: { readonly base: number }, increment: number) {
        receivers.push(this);
        return this.base + increment;
      }, []);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
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

    function Model(): undefined {
      const [dependency, setDependency] = Behave.useState(Number.NaN);
      const [epoch, setEpoch] = Behave.useState(0);
      const previous = callbacks.at(-1);
      const callback = Behave.useCallback(
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
      const memo = Behave.useMemo(() => {
        // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
        memoRuns += 1;
        return callback;
      }, [callback]);
      const derived = Behave.useCallback(() => memo(), [memo]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      derivedCallbacks.push(derived);
      Behave.useEffect(() => {
        const effectValue = callback();
        effects.push(`setup:${effectValue}`);
        return () => effects.push(`cleanup:${effectValue}`);
      }, [callback]);
      const setDependencyBody = Behave.useCallback((value: number) => setDependency(value), [setDependency]);
      const tickBody = Behave.useCallback(() => setEpoch((value) => value + 1), [setEpoch]);
      Behave.useSignal("setDependency", setDependencyBody);
      Behave.useSignal("tick", tickBody);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    const initial = callbacks[0];
    const initialDerived = derivedCallbacks[0];
    expect(initial()).toBe("NaN:0");

    root.tick();
    await waitFor(() => callbacks.length === 2);
    expect(callbacks[1]).toBe(initial);
    expect(callbacks[1]()).toBe("NaN:0");
    expect(derivedCallbacks[1]).toBe(initialDerived);
    expect(memoRuns).toBe(1);
    expect(effects).toEqual(["setup:NaN:0"]);

    root.setDependency(-0);
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

    root.setDependency(+0);
    await waitFor(() => callbacks.length === 4);
    const positiveZero = callbacks[3];
    expect(positiveZero).not.toBe(negativeZero);
    expect(positiveZero()).toBe("0:1");

    root.tick();
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

    function Model(): undefined {
      const [version, setVersion] = Behave.useState(0);
      const advanceBody = Behave.useCallback(() => setVersion((value) => value + 1), [setVersion]);
      const signalBody = Behave.useCallback(() => trace.push(`signal:${version}`), [version]);
      const slotBody = Behave.useCallback(() => trace.push(`slot:${version}`), [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      signalBodies.push(signalBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slotBodies.push(slotBody);
      Behave.useSignal("advance", advanceBody);
      const fire = Behave.useSignal("fire", signalBody);
      const receive = Behave.useSlot("receive", slotBody);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      fireHandles.push(fire);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slotHandles.push(receive);
      const disconnect = Behave.useConnect(fire, receive);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      disconnects.push(disconnect);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    const firstSignalBody = signalBodies[0];
    const firstSlotBody = slotBodies[0];
    root.fire();
    slotHandles[0]();
    expect(trace).toEqual(["signal:0", "slot:0", "slot:0"]);

    trace.length = 0;
    root.advance();
    await waitFor(() => signalBodies.length === 2);
    expect(fireHandles[1]).toBe(fireHandles[0]);
    expect(slotHandles[1]).toBe(slotHandles[0]);
    expect(disconnects[1]).toBe(disconnects[0]);
    expect(signalBodies[1]).not.toBe(firstSignalBody);
    expect(slotBodies[1]).not.toBe(firstSlotBody);
    root.fire();
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

    function Model(): undefined {
      const [version, setVersion] = Behave.useState(0);
      const inspect = Behave.useCallback(() => version, [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(inspect);
      const advance = Behave.useCallback(() => setVersion(1), [setVersion]);
      Behave.useSignal("advance", advance);
      const inspectEndpoint = Behave.useCallback(() => endpointResults.push(version), [version]);
      Behave.useSignal("inspect", inspectEndpoint);
      if (version === 1 && shouldThrow) throw failure;
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    const committed = callbacks[0];
    root.inspect();
    shouldThrow = true;
    expect(await captureScheduledFailure(() => root.advance())).toBe(failure);
    const aborted = callbacks[1];
    expect(aborted).not.toBe(committed);
    expect(committed()).toBe(0);
    expect(aborted()).toBe(1);
    expect(endpointResults).toEqual([0]);
    expect(() => Behave.getInterface(root)).toThrow(/disposed/);
    expect(committed()).toBe(0);
    expect(aborted()).toBe(1);
  });

  it("D keeps a callback retained from failed construction callable", () => {
    const failure = new Error("construction failed");
    let candidate: (() => string) | undefined;

    function Broken(): never {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      candidate = Behave.useCallback(() => "candidate", []);
      throw failure;
    }

    expect(() => Behave.createModel(Broken, undefined)).toThrow(failure);
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

    function Model(): undefined {
      const [, setValue] = Behave.useState(0);
      const renderedPhase = phase;
      const inspect = Behave.useCallback(() => renderedPhase, [renderedPhase]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(inspect);
      const inspectEndpoint = Behave.useCallback(() => endpointResults.push(renderedPhase), [renderedPhase]);
      Behave.useSignal("inspect", inspectEndpoint);
      const speculate = Behave.useCallback(() => setValue((previous) => {
        phase = 1;
        return previous;
      }), [setValue]);
      Behave.useSignal("speculate", speculate);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    root.speculate();
    await settle();
    expect(callbacks).toHaveLength(2);
    expect(callbacks[1]).not.toBe(callbacks[0]);
    expect(callbacks[0]()).toBe(0);
    expect(callbacks[1]()).toBe(1);
    root.inspect();
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

    function Model(): undefined {
      const [version, setVersion] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setter = setVersion;
      const inspect = Behave.useCallback(() => version, [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(inspect);
      const advance = Behave.useCallback(() => setVersion(1), [setVersion]);
      Behave.useSignal("advance", advance);
      const inspectHandle = Behave.useSignal("inspect", inspect);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      handles.push(inspectHandle);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    root.advance();
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

    function Model(): undefined {
      const [, setValue] = Behave.useState(0);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setter = setValue;
      const inspect = Behave.useCallback(() => trace.push("endpoint"), []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      endpoint = Behave.useSignal("inspect", inspect);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      ordinary = Behave.useCallback(function (this: { readonly label: string }) {
        trace.push(`ordinary:${this.label}`);
        return this.label;
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      throwing = Behave.useCallback(() => {
        throw failure;
      }, []);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      invokeSetter = Behave.useCallback(() => {
        trace.push("setter-body");
        setter?.(1);
        return "setter-return";
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only retained-callback probe observes an outer mutable capability after disposal
      }, [setter]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      invokeEndpoint = Behave.useCallback(() => {
        trace.push("endpoint-body");
        endpoint?.();
        return "unreachable";
      // eslint-disable-next-line behavon-hooks/exhaustive-deps -- test-only retained-callback probe observes an outer mutable capability after disposal
      }, [endpoint]);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
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
      foreign = Behave.useCallback(() => undefined, []);
      return undefined;
    }
    const owner = Behave.createModel(Owner, undefined);

    function Ordinary(): undefined {
      Behave.useSignal("ordinary", () => undefined);
      return undefined;
    }
    function CrossOwner(): undefined {
      Behave.useSignal("foreign", foreign as () => void);
      return undefined;
    }
    expect(() => Behave.createModel(Ordinary, undefined)).toThrow(/managed callback from the same Model/);
    expect(() => Behave.createModel(CrossOwner, undefined)).toThrow(/managed callback from the same Model/);
    owner.dispose();

    interface Endpoints {
      readonly advance: Signal;
      readonly retained: Signal;
      readonly current: Signal;
    }
    const trace: number[] = [];
    let retained: (() => void) | undefined;
    function Model(): undefined {
      const [version, setVersion] = Behave.useState(0);
      const current = Behave.useCallback(() => trace.push(version), [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      retained ??= current;
      const advance = Behave.useCallback(() => setVersion(1), [setVersion]);
      Behave.useSignal("advance", advance);
      Behave.useSignal("retained", retained);
      Behave.useSignal("current", current);
      return undefined;
    }
    const root = Behave.createModel(Model, undefined);
    root.advance();
    await settle();
    root.retained();
    root.current();
    expect(trace).toEqual([0, 1]);
    root.dispose();
  });

  it("H preserves multi-name, multi-role, and multi-registration cardinality across version changes", async () => {
    interface Endpoints {
      readonly advance: Signal;
      readonly first: Signal;
      readonly second: Signal;
    }
    const callbacks: Array<() => void> = [];
    const slotHandles: Slot[] = [];
    const trace: number[] = [];

    function Model(): undefined {
      const [version, setVersion] = Behave.useState(0);
      const shared = Behave.useCallback(() => trace.push(version), [version]);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      callbacks.push(shared);
      const advance = Behave.useCallback(() => setVersion(1), [setVersion]);
      Behave.useSignal("advance", advance);
      Behave.useSignal("first", shared);
      Behave.useSignal("first", shared);
      Behave.useSignal("second", shared);
      const firstSlot = Behave.useSlot("first", shared);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      slotHandles.push(firstSlot);
      return undefined;
    }

    const root = Behave.createModel(Model, undefined);
    root.first();
    root.second();
    slotHandles[0]();
    expect(trace).toEqual([0, 0, 0, 0]);

    trace.length = 0;
    root.advance();
    await settle();
    root.first();
    root.second();
    slotHandles[1]();
    expect(trace).toEqual([1, 1, 1, 1]);
    callbacks[0]();
    expect(trace.at(-1)).toBe(0);
    root.dispose();
  });
});
