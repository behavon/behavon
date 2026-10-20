import { describe, expect, it, vi } from "vitest";
import Behavon, { FutureCancellationError, futureDiagnostics } from "behavon";
import type { BoundaryState, Future, Signal, StateSetter } from "behavon";
import { inspectModelInstanceForTests, observeModelInstanceCreationForTests } from "../../src/internal/model-inspection";
import { waitFor } from "../helpers";

function outputOf<Value>(ref: object): Value {
  return inspectModelInstanceForTests(ref).output as Value;
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

describe("useFuture", () => {
  it("is structurally compatible with native AbortSignal in DOM consumers", () => {
    function Model() {
      const future = Behavon.useFuture(async (input: string, context) => {
        const native: AbortSignal = context.signal;
        const request = fetch(input, { signal: context.signal });
        // @ts-expect-error Native dispatchEvent requires an Event, not an event-shaped plain object.
        context.signal.dispatchEvent({ type: "abort" });
        void native;
        return request;
      }, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    expect(outputOf<Future<string, Response>>(root).snapshot()).toEqual({ status: "idle" });
    root.dispose();
  });

  it("keeps a stable frozen lazy handle and publishes idle, pending, then fulfilled through commits", async () => {
    const work = vi.fn((input: number) => input * 2);
    const effects: string[] = [];
    function Model() {
      const future = Behavon.useFuture(work, { concurrency: "serial" });
      const snapshot = future.snapshot();
      Behavon.useEffect(() => { effects.push(snapshot.status); }, [snapshot]);
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<number, number>>(root);
    expect(Object.isFrozen(future)).toBe(true);
    expect(future.snapshot()).toEqual({ status: "idle" });
    expect(work).not.toHaveBeenCalled();

    const events: string[] = [];
    future.pending.subscribe(({ input }) => events.push(`pending:${input}`));
    future.fulfilled.subscribe(({ input, value }) => events.push(`fulfilled:${input}:${value}`));
    const completion = future.start(3).then((value) => { events.push(`promise:${value}`); return value; });
    expect(future.snapshot()).toEqual({ status: "idle" });
    await expect(completion).resolves.toBe(6);
    expect(effects).toEqual(["idle", "pending", "fulfilled"]);
    expect(events).toEqual(["pending:3", "fulfilled:3:6", "promise:6"]);
    expect(outputOf<Future<number, number>>(root)).toBe(future);
    root.dispose();
  });

  it("serializes FIFO runs and captures the latest committed factory when a queued run starts", async () => {
    const first = deferred<number>();
    let version = 1;
    function Model() {
      const [, rerender] = Behavon.useState(0);
      const capturedVersion = version;
      const future = Behavon.useFuture((value: number) => capturedVersion === 1 ? first.promise : value * capturedVersion, { concurrency: "serial" });
      return { future, rerender, capturedVersion };
    }
    const root = Behavon.createModel(Model, undefined);
    const initial = outputOf<ReturnType<typeof Model>>(root);
    const future = initial.future;
    const one = future.start(1);
    const two = future.start(2);
    version = 3;
    initial.rerender(1);
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root).capturedVersion === 3);
    first.resolve(10);
    await expect(one).resolves.toBe(10);
    await expect(two).resolves.toBe(6);
    root.dispose();
  });

  it("latest supersedes with ordered rejected publication before replacement pending", async () => {
    const calls = new Map<number, ReturnType<typeof deferred<number>>>();
    function Model() {
      const future = Behavon.useFuture((input: number) => {
        const call = deferred<number>();
        calls.set(input, call);
        return call.promise;
      }, { concurrency: "latest" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<number, number>>(root);
    const events: string[] = [];
    future.pending.subscribe(({ input }) => events.push(`p${input}`));
    future.rejected.subscribe(({ input, reason }) => events.push(`r${input}:${(reason as FutureCancellationError).kind}`));
    const one = future.start(1);
    await waitFor(() => calls.has(1));
    const two = future.start(2);
    await expect(one).rejects.toMatchObject({ kind: "superseded" });
    await waitFor(() => calls.has(2));
    calls.get(2)?.resolve(20);
    await expect(two).resolves.toBe(20);
    expect(events.slice(0, 3)).toEqual(["p1", "r1:superseded", "p2"]);
    root.dispose();
  });

  it("distinguishes explicit, self, and owner-dispose cancellation and fences late rejection diagnostics", async () => {
    const active = deferred<number>();
    let selfAbort: ((reason?: unknown) => void) | undefined;
    function Model() {
      const future = Behavon.useFuture((_input: string, context) => {
        selfAbort = context.abort;
        return active.promise;
      }, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<string, number>>(root);
    const diagnostics: unknown[] = [];
    const unsubscribe = futureDiagnostics.subscribe(value => diagnostics.push(value));
    const first = future.start("explicit");
    await waitFor(() => selfAbort !== undefined);
    future.abort("stop");
    await expect(first).rejects.toMatchObject({ kind: "explicit", cause: "stop" });
    active.reject(new Error("late abnormal"));
    await waitFor(() => diagnostics.length === 1);

    const secondWork = deferred<number>();
    function SelfModel() {
      const next = Behavon.useFuture((_input: string, context) => {
        context.abort("factory-stop");
        return secondWork.promise;
      }, { concurrency: "serial" });
      return next;
    }
    const selfRoot = Behavon.createModel(SelfModel, undefined);
    await expect(outputOf<Future<string, number>>(selfRoot).start("self")).rejects.toMatchObject({ kind: "self", cause: "factory-stop" });
    selfRoot.dispose();

    const disposeWork = deferred<number>();
    function DisposeModel() {
      const next = Behavon.useFuture(() => disposeWork.promise, { concurrency: "serial" });
      return next;
    }
    const disposeRoot = Behavon.createModel(DisposeModel, undefined);
    const retained = outputOf<Future<void, number>>(disposeRoot);
    const disposed = retained.start(undefined);
    await waitFor(() => retained.snapshot().status === "pending");
    disposeRoot.dispose();
    await expect(disposed).rejects.toMatchObject({ kind: "owner-dispose" });
    expect(() => retained.snapshot()).toThrow(/requires a live Model instance/);
    expect(() => retained.start(undefined)).toThrow(/requires a live Model instance/);
    expect(() => retained.abort()).toThrow(/requires a live Model instance/);
    expect(() => retained.pending.subscribe(() => undefined)).toThrow(/requires a live Model instance/);
    unsubscribe();
  });

  it("diagnoses undefined late rejection without suppressing expected cause and AbortError identities", async () => {
    const diagnostics: unknown[] = [];
    const unsubscribe = futureDiagnostics.subscribe(value => diagnostics.push(value));
    const runCase = async (reason: unknown, late: unknown): Promise<void> => {
      const work = deferred<number>();
      function Model() {
        const future = Behavon.useFuture<void, number>(() => work.promise, { concurrency: "serial" });
        return future;
      }
      const root = Behavon.createModel(Model, undefined);
      const future = outputOf<Future<void, number>>(root);
      const completion = future.start(undefined);
      await waitFor(() => future.snapshot().status === "pending");
      future.abort(reason);
      await expect(completion).rejects.toMatchObject({ kind: "explicit", cause: reason });
      work.reject(late);
      await Promise.resolve();
      await Promise.resolve();
      root.dispose();
    };

    try {
      await runCase(undefined, undefined);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({ type: "late-rejection", error: undefined });

      const suppliedCause = Object.freeze({ kind: "supplied-cause" });
      await runCase(suppliedCause, suppliedCause);
      expect(diagnostics).toHaveLength(1);

      await runCase(undefined, new DOMException("aborted", "AbortError"));
      expect(diagnostics).toHaveLength(1);
    } finally {
      unsubscribe();
    }
  });

  it("normalizes synchronous throw, then getter throw, and custom thenable settlement", async () => {
    const getterFailure = new Error("then getter failed");
    function Model() {
      const future = Behavon.useFuture((kind: string): number | PromiseLike<number> => {
        if (kind === "throw") throw new Error("factory failed");
        if (kind === "getter") return Object.defineProperty({}, "then", { get: () => { throw getterFailure; } }) as PromiseLike<number>;
        return { then: (resolve: (value: number) => void) => { resolve(42); } } as unknown as PromiseLike<number>;
      }, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<string, number>>(root);
    await expect(future.start("throw")).rejects.toThrow("factory failed");
    await expect(future.start("getter")).rejects.toBe(getterFailure);
    await expect(future.start("thenable")).resolves.toBe(42);
    root.dispose();
  });

  it("keeps reentrant serial work deterministic when an occurrence listener throws", async () => {
    const surfaced = new Error("listener failed");
    const values: number[] = [];
    function Model() {
      const future = Behavon.useFuture((input: number) => input, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<number, number>>(root);
    let second: Promise<number> | undefined;
    future.fulfilled.subscribe(({ input }) => {
      values.push(input);
      if (input === 1) second = future.start(2);
      throw surfaced;
    });
    const originalSetTimeout = globalThis.setTimeout;
    const failures: unknown[] = [];
    globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
      try { if (typeof handler === "function") handler(); }
      catch (error: unknown) { failures.push(error); }
      return originalSetTimeout(() => undefined, 0);
    }) as typeof setTimeout;
    try {
      await expect(future.start(1)).resolves.toBe(1);
      await waitFor(() => second !== undefined);
      await expect(second).resolves.toBe(2);
      await waitFor(() => failures.length >= 1);
      expect(failures[0]).toBe(surfaced);
      expect(values).toEqual([1, 2]);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      root.dispose();
    }
  });

  it("publishes a pending-listener failure as its original rejection and continues the serial queue", async () => {
    const listenerFailure = new Error("pending listener failed");
    const factory = vi.fn((input: number) => input);
    function Model() {
      const future = Behavon.useFuture(factory, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<number, number>>(root);
    const events: string[] = [];
    const surfaced: unknown[] = [];
    future.pending.subscribe(({ input }) => {
      events.push(`pending:${input}`);
      if (input === 1) throw listenerFailure;
    });
    future.rejected.subscribe(({ input, reason }) => {
      events.push(`rejected:${input}:${reason === listenerFailure ? "original" : "changed"}`);
    });
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
      try { if (typeof handler === "function") handler(); }
      catch (error: unknown) { surfaced.push(error); }
      return originalSetTimeout(() => undefined, 0);
    }) as typeof setTimeout;
    try {
      const first = future.start(1);
      void first.catch(() => undefined);
      const second = future.start(2);
      await expect(first).rejects.toBe(listenerFailure);
      await expect(second).resolves.toBe(2);
      await waitFor(() => surfaced.includes(listenerFailure));
      expect(factory).toHaveBeenCalledTimes(1);
      expect(factory).toHaveBeenCalledWith(2, expect.objectContaining({ signal: expect.any(Object), abort: expect.any(Function) }));
      expect(events).toEqual([
        "pending:1",
        "rejected:1:original",
        "pending:2",
      ]);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      root.dispose();
    }
  });

  it("does not duplicate an explicit cancellation transition requested by a pending listener", async () => {
    const factory = vi.fn((input: number) => input);
    function Model() {
      const future = Behavon.useFuture(factory, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<number, number>>(root);
    const events: string[] = [];
    const hostFailures: unknown[] = [];
    future.pending.subscribe(({ input }) => {
      events.push(`pending:${input}`);
      future.abort("listener-stop");
    });
    future.rejected.subscribe(({ reason }) => {
      events.push(`rejected:${(reason as FutureCancellationError).kind}`);
    });
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
      try { if (typeof handler === "function") handler(); }
      catch (error: unknown) { hostFailures.push(error); }
      return originalSetTimeout(() => undefined, 0);
    }) as typeof setTimeout;
    try {
      const completion = future.start(1);
      await expect(completion).rejects.toMatchObject({ kind: "explicit", cause: "listener-stop" });
      expect(factory).not.toHaveBeenCalled();
      expect(events).toEqual(["pending:1", "rejected:explicit"]);
      expect(hostFailures).toEqual([]);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      root.dispose();
    }
  });

  it("does not duplicate a latest supersede transition requested by a pending listener", async () => {
    const factory = vi.fn((input: number) => input * 10);
    function Model() {
      const future = Behavon.useFuture(factory, { concurrency: "latest" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<number, number>>(root);
    const events: string[] = [];
    const hostFailures: unknown[] = [];
    let replacement: Promise<number> | undefined;
    future.pending.subscribe(({ input }) => {
      events.push(`pending:${input}`);
      if (input === 1) replacement = future.start(2);
    });
    future.rejected.subscribe(({ input, reason }) => {
      events.push(`rejected:${input}:${(reason as FutureCancellationError).kind}`);
    });
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0]) => {
      try { if (typeof handler === "function") handler(); }
      catch (error: unknown) { hostFailures.push(error); }
      return originalSetTimeout(() => undefined, 0);
    }) as typeof setTimeout;
    try {
      const superseded = future.start(1);
      await expect(superseded).rejects.toMatchObject({ kind: "superseded" });
      await waitFor(() => replacement !== undefined);
      await expect(replacement).resolves.toBe(20);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(factory).toHaveBeenCalledWith(2, expect.any(Object));
      expect(events).toEqual([
        "pending:1",
        "rejected:1:superseded",
        "pending:2",
      ]);
      expect(hostFailures).toEqual([]);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      root.dispose();
    }
  });

  it("scrubs a provisional Future after failed construction without invoking its factory", async () => {
    const factory = vi.fn(async () => 1);
    let retained: Future<void, number> | undefined;
    let created: object | undefined;
    const stop = observeModelInstanceCreationForTests((instance) => { created = instance; });
    function Broken(): never {
      const future = Behavon.useFuture<void, number>(factory, { concurrency: "serial" });
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only failed-construction capability probe
      retained = future;
      throw new Error("construction failed");
    }
    expect(() => Behavon.createModel(Broken, undefined)).toThrow("construction failed");
    stop();
    expect(factory).not.toHaveBeenCalled();
    expect(created === undefined ? undefined : inspectModelInstanceForTests(created).status).toBe("disposed");
    expect(() => retained?.snapshot()).toThrow(/requires a live Model instance/);
    await expect(Promise.resolve().then(() => retained?.start(undefined))).rejects.toThrow(/requires a live Model instance/);
  });

  it("warns but executes evaluation commands and leaves snapshot reads warning-free", async () => {
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args); };
    let completion: Promise<number> | undefined;
    function Model() {
      const future = Behavon.useFuture(async (input: number) => input, { concurrency: "serial" });
      future.snapshot();
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- invalid-reproduction runtime policy probe
      completion ??= future.start(7);
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    try {
      await expect(completion).resolves.toBe(7);
      expect(warnings).toHaveLength(1);
      expect(String(warnings[0]?.[0])).toMatch(/useFuture command 'start'.*while evaluating/);
    } finally {
      console.warn = originalWarn;
      root.dispose();
    }
  });

  it("executes transaction.run commands immediately and does not roll them back", async () => {
    interface Port { run: Signal }
    const port = Behavon.createPort<Port>({ run: Behavon.SignalType() });
    const state = Behavon.createId({ value: Behavon.StateType<number>() });
    const work = deferred<number>();
    let completion: Promise<number> | undefined;
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args); };
    function Model(): { value: number; future: Future<void, number> } {
      const [value, setValue] = Behavon.useLabelState(state.value, 0);
      const future = Behavon.useFuture<void, number>(() => work.promise, { concurrency: "serial" });
      const run = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [state.value]);
        Behavon.transaction.run(id, () => {
          completion = future.start(undefined);
          setValue(1);
          throw new Error("rollback");
        });
      }, [future, setValue]);
      Behavon.useSignal(port, "run", run);
      Behavon.useExport(port, "run");
      return { value, future };
    }
    const root = Behavon.createModel(Model, undefined);
    try {
      expect(() => root.run()).toThrow("rollback");
      await waitFor(() => outputOf<ReturnType<typeof Model>>(root).future.snapshot().status === "pending");
      work.resolve(9);
      await expect(completion).resolves.toBe(9);
      expect(outputOf<ReturnType<typeof Model>>(root).value).toBe(0);
      expect(warnings.some(args => String(args[0]).includes("inside transaction.run is immediate and nontransactional"))).toBe(true);
    } finally {
      console.warn = originalWarn;
      root.dispose();
    }
  });

  it("rejects an active Child Future through commit-phase Boundary disposal", async () => {
    const work = deferred<number>();
    let completion: Promise<number> | undefined;
    function Child(fail: boolean): Future<void, number> {
      const future = Behavon.useFuture<void, number>(() => work.promise, { concurrency: "serial" });
      Behavon.useEffect(() => {
        completion = future.start(undefined);
        void completion.catch(() => undefined);
      }, [future]);
      Behavon.useEffect(() => {
        if (fail) throw new Error("commit failure");
      }, [fail]);
      return future;
    }
    const SafeChild = Behavon.boundary(Child);
    const root = Behavon.createModel(SafeChild, false);
    let state: BoundaryState<Future<void, number>> | undefined;
    let setInput: StateSetter<boolean> | undefined;
    function Observer(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only Boundary state probe
      [state, setInput] = Behavon.useModel(root);
      return undefined;
    }
    const observer = Behavon.createModel(Observer, undefined);
    await waitFor(() => state?.status === "active" && state.output.snapshot().status === "pending");
    setInput?.(true);
    await waitFor(() => state?.status === "failed");
    await expect(completion).rejects.toMatchObject({ kind: "owner-dispose" });
    observer.dispose();
    root.dispose();
  });

  it("terminal cleanup aborts the exact completed controller before the next serial run starts", async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const signals: Array<{ input: number; signal: { readonly aborted: boolean } }> = [];
    function Model() {
      const future = Behavon.useFuture((input: number, { signal }) => {
        signals.push({ input, signal });
        return input === 1 ? first.promise : second.promise;
      }, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<number, number>>(root);
    const one = future.start(1);
    const two = future.start(2);
    await waitFor(() => signals.length === 1);
    first.resolve(10);
    await expect(one).resolves.toBe(10);
    await waitFor(() => signals.length === 2);
    expect(signals[0]?.signal.aborted).toBe(true);
    expect(signals[1]?.signal.aborted).toBe(false);
    second.resolve(20);
    await expect(two).resolves.toBe(20);
    expect(signals[1]?.signal.aborted).toBe(true);
    root.dispose();
  });

  it("reuses one exact transition snapshot across evaluation, commit, occurrence, and unrelated reevaluation", async () => {
    const work = deferred<number>();
    const effectSnapshots: Array<Readonly<{ status: string }>> = [];
    function Model() {
      const [tick, setTick] = Behavon.useState(0);
      const future = Behavon.useFuture<void, number>(() => work.promise, { concurrency: "serial" });
      const snapshot = future.snapshot();
      Behavon.useEffect(() => {
        effectSnapshots.push(snapshot);
      }, [snapshot]);
      return { tick, setTick, future, snapshot };
    }
    const root = Behavon.createModel(Model, undefined);
    const initial = outputOf<ReturnType<typeof Model>>(root);
    let pendingAtOccurrence: unknown;
    let pendingOutputAtOccurrence: unknown;
    let terminalAtOccurrence: unknown;
    initial.future.pending.subscribe(() => {
      pendingAtOccurrence = initial.future.snapshot();
      pendingOutputAtOccurrence = outputOf<ReturnType<typeof Model>>(root).snapshot;
    });
    initial.future.fulfilled.subscribe(() => {
      terminalAtOccurrence = initial.future.snapshot();
    });

    const completion = initial.future.start(undefined);
    await waitFor(() => pendingAtOccurrence !== undefined);
    const pendingOutput = outputOf<ReturnType<typeof Model>>(root);
    expect(pendingAtOccurrence).toBe(pendingOutputAtOccurrence);
    expect(pendingAtOccurrence).toBe(pendingOutput.snapshot);
    expect(pendingAtOccurrence).toBe(initial.future.snapshot());
    expect(Object.isFrozen(pendingOutput.snapshot)).toBe(true);
    expect(effectSnapshots.map(snapshot => snapshot.status)).toEqual(["idle", "pending"]);

    pendingOutput.setTick(1);
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root).tick === 1);
    expect(outputOf<ReturnType<typeof Model>>(root).snapshot).toBe(pendingOutput.snapshot);
    expect(effectSnapshots.map(snapshot => snapshot.status)).toEqual(["idle", "pending"]);

    work.resolve(42);
    await expect(completion).resolves.toBe(42);
    const terminalOutput = outputOf<ReturnType<typeof Model>>(root);
    expect(terminalAtOccurrence).toBe(terminalOutput.snapshot);
    expect(terminalAtOccurrence).toBe(initial.future.snapshot());
    expect(Object.isFrozen(terminalOutput.snapshot)).toBe(true);
    expect(effectSnapshots.map(snapshot => snapshot.status)).toEqual(["idle", "pending", "fulfilled"]);

    terminalOutput.setTick(2);
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root).tick === 2);
    expect(outputOf<ReturnType<typeof Model>>(root).snapshot).toBe(terminalOutput.snapshot);
    expect(effectSnapshots.map(snapshot => snapshot.status)).toEqual(["idle", "pending", "fulfilled"]);
    root.dispose();
  });

  it("cancels an evaluation-started provisional run when later construction fails", async () => {
    const factory = vi.fn(async () => 1);
    let completion: Promise<number> | undefined;
    function Broken(): never {
      const future = Behavon.useFuture<void, number>(factory, { concurrency: "serial" });
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- invalid-reproduction provisional cleanup probe
      completion = future.start(undefined);
      void completion.catch(() => undefined);
      throw new Error("after start");
    }
    expect(() => Behavon.createModel(Broken, undefined)).toThrow("after start");
    await expect(completion).rejects.toMatchObject({ kind: "owner-dispose" });
    expect(factory).not.toHaveBeenCalled();
  });

  it("preserves a fulfilled terminal outcome when its occurrence listener disposes the owner", async () => {
    const work = deferred<number>();
    function Model() {
      const future = Behavon.useFuture((input: number) => input === 1 ? work.promise : input, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<number, number>>(root);
    const events: string[] = [];
    future.fulfilled.subscribe(({ value }) => {
      events.push(`fulfilled:${value}`);
      root.dispose();
    });
    const completion = future.start(1);
    const queued = future.start(2);
    void queued.catch(() => undefined);
    void completion.then(
      value => { events.push(`promise:${value}`); },
      reason => { events.push(`rejected:${String((reason as FutureCancellationError).kind)}`); },
    );
    work.resolve(42);

    await expect(completion).resolves.toBe(42);
    await expect(queued).rejects.toMatchObject({ kind: "owner-dispose" });
    expect(events).toEqual(["fulfilled:42", "promise:42"]);
  });

  it("preserves a rejected terminal outcome when its occurrence listener disposes the owner", async () => {
    const work = deferred<number>();
    const failure = new Error("factory rejected");
    function Model() {
      const future = Behavon.useFuture<void, number>(() => work.promise, { concurrency: "serial" });
      return future;
    }
    const root = Behavon.createModel(Model, undefined);
    const future = outputOf<Future<void, number>>(root);
    const events: string[] = [];
    future.rejected.subscribe(({ reason }) => {
      events.push(reason === failure ? "rejected:factory" : `rejected:${String((reason as FutureCancellationError).kind)}`);
      root.dispose();
    });
    const completion = future.start(undefined);
    void completion.then(
      value => { events.push(`fulfilled:${value}`); },
      reason => { events.push(reason === failure ? "promise:factory" : `promise:${String((reason as FutureCancellationError).kind)}`); },
    );
    work.reject(failure);

    await expect(completion).rejects.toBe(failure);
    expect(events).toEqual(["rejected:factory", "promise:factory"]);
  });
});
