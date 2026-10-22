import { describe, expect, it, vi } from "vitest";
import Behavon, { ResourceActionSupersededError } from "behavon";
import type { ResourceAbortSignal } from "behavon";
import { inspectModelInstanceForTests, inspectRetainedOperationForTests } from "../../src/internal/model-inspection";
import { waitFor } from "../helpers";

function outputOf<Value>(ref: object): Value {
  return inspectModelInstanceForTests(ref).output as Value;
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

describe("useResource", () => {
  it("exposes a small immutable snapshot and a stable frozen controller", async () => {
    const Resource = Behavon.createResource({
      open: () => ({ value: 1 }),
      close: () => undefined,
      abort: () => undefined,
      actions: {
        read: ({ resource }: { resource: { value: number }; signal: ResourceAbortSignal }) => resource.value,
      },
    });
    function Model(input: number) {
      const [snapshot, controller] = Behavon.useResource(Resource, input);
      return { snapshot, controller };
    }
    const root = Behavon.createModel(Model, 1);
    const initial = outputOf<ReturnType<typeof Model>>(root);
    expect(initial.snapshot).toEqual({ phase: "closed", closedBy: "initial" });
    expect(Object.isFrozen(initial.snapshot)).toBe(true);
    expect(Object.isFrozen(initial.controller)).toBe(true);

    const open = initial.controller.open();
    expect(open.getResult()).toEqual({ status: "succeeded", outcome: "opened" });
    expect(initial.controller.read()).toBe(1);
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root).snapshot.phase === "open");
    expect(outputOf<ReturnType<typeof Model>>(root).controller).toBe(initial.controller);

    const close = initial.controller.close("done");
    expect(close.getResult()).toEqual({ status: "succeeded", outcome: "closed" });
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root).snapshot.phase === "closed");
    expect(outputOf<ReturnType<typeof Model>>(root).snapshot).toEqual({ phase: "closed", closedBy: "close", reason: "done" });
    root.dispose();
  });

  it("coalesces duplicate opening work while retaining per-call requests", async () => {
    const opening = deferred<{ id: number }>();
    const open = vi.fn(() => opening.promise);
    const Resource = Behavon.createResource({ open, close: () => undefined, abort: () => undefined });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    const requested: unknown[] = [];
    const started: unknown[] = [];
    controller.openRequested.subscribe(payload => requested.push(payload));
    controller.openStarted.subscribe(payload => started.push(payload));

    const first = controller.open();
    const second = controller.open();
    expect(open).toHaveBeenCalledTimes(1);
    expect(first.id).not.toBe(second.id);
    expect(first.operation).toBe(second.operation);
    expect(first.execution).toBe("started");
    expect(second.execution).toBe("coalesced");
    expect(requested).toHaveLength(2);
    expect(started).toHaveLength(1);

    opening.resolve({ id: 1 });
    await waitFor(() => first.getResult().status === "succeeded");
    expect(second.getResult()).toEqual({ status: "succeeded", outcome: "opened" });
    root.dispose();
  });

  it("keeps the original opening operation alive when a coalesced request listener throws", async () => {
    const opening = deferred<object>();
    const Resource = Behavon.createResource({ open: () => opening.promise, close: () => undefined, abort: () => undefined });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    let requests = 0;
    const failure = new Error("second request failed");
    controller.openRequested.subscribe(() => { if (++requests === 2) throw failure; });
    const first = controller.open();
    expect(() => controller.open()).toThrow(failure);
    expect(first.getResult()).toEqual({ status: "pending" });
    opening.resolve({});
    await waitFor(() => first.getResult().status === "succeeded");
    root.dispose();
  });

  it("removes a queued close whose request listener throws", async () => {
    const opening = deferred<object>();
    const close = vi.fn();
    const failure = new Error("queued close request failed");
    const Resource = Behavon.createResource({ open: () => opening.promise, close, abort: () => undefined });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.closeRequested.subscribe(() => { throw failure; });
    controller.open();
    expect(() => controller.close()).toThrow(failure);
    opening.resolve({});
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root)[0].phase === "open");
    expect(close).not.toHaveBeenCalled();
    root.dispose();
  });

  it("lets a reentrant abort during openRequested prevent driver start", () => {
    const open = vi.fn(() => ({}));
    const Resource = Behavon.createResource({ open, close: () => undefined, abort: () => undefined });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.openRequested.subscribe(() => { controller.abort("cancelled"); });
    const request = controller.open();
    expect(open).not.toHaveBeenCalled();
    expect(request.getResult()).toEqual({ status: "superseded", by: "abort" });
    root.dispose();
  });

  it("lets a reentrant abort during closeRequested and closeStarted prevent the close driver", async () => {
    for (const occurrence of ["closeRequested", "closeStarted"] as const) {
      const close = vi.fn();
      const abort = vi.fn();
      const Resource = Behavon.createResource({ open: () => ({}), close, abort });
      function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
      const root = Behavon.createModel(Model, undefined);
      const controller = outputOf<ReturnType<typeof Model>>(root)[1];
      controller.open();
      controller[occurrence].subscribe(() => { controller.abort(occurrence); });
      const request = controller.close();
      expect(close).not.toHaveBeenCalled();
      expect(abort).toHaveBeenCalledTimes(1);
      expect(request.getResult()).toEqual({ status: "superseded", by: "abort" });
      await waitFor(() => {
        const snapshot = outputOf<ReturnType<typeof Model>>(root)[0];
        return snapshot.phase === "closed" && snapshot.closedBy === "abort";
      });
      expect(outputOf<ReturnType<typeof Model>>(root)[0]).toEqual({ phase: "closed", closedBy: "abort", reason: occurrence });
      root.dispose();
    }
  });

  it("preserves an abortRequested listener failure after completing invalidation", async () => {
    const failure = new Error("abort listener failed");
    const abort = vi.fn();
    const Resource = Behavon.createResource({ open: () => ({}), close: () => undefined, abort });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    controller.abortRequested.subscribe(() => { throw failure; });
    expect(() => controller.abort("stop")).toThrow(failure);
    expect(abort).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const snapshot = outputOf<ReturnType<typeof Model>>(root)[0];
      return snapshot.phase === "closed" && snapshot.closedBy === "abort";
    });
    expect(outputOf<ReturnType<typeof Model>>(root)[0]).toEqual({ phase: "closed", closedBy: "abort", reason: "stop" });
    root.dispose();
  });

  it("projects close failure to closed without reviving capability", async () => {
    const failure = new Error("close failed");
    const cleanup = vi.fn();
    const Resource = Behavon.createResource({
      open: () => ({ value: 1 }),
      close: () => { throw failure; },
      abort: cleanup,
      actions: { read: ({ resource }: { resource: { value: number }; signal: ResourceAbortSignal }) => resource.value },
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    const close = controller.close("shutdown");
    expect(close.getResult()).toEqual({ status: "failed", error: failure });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(() => controller.read()).toThrow(/requires an open resource/);
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root)[0].phase === "closed");
    expect(outputOf<ReturnType<typeof Model>>(root)[0]).toEqual({ phase: "closed", closedBy: "closeFailed", reason: "shutdown" });
    root.dispose();
  });

  it("treats a throwing then getter as an operation failure", async () => {
    const openFailure = new Error("open then getter failed");
    const closeFailure = new Error("close then getter failed");
    const throwingOpen = Object.defineProperty({}, "then", { get() { throw openFailure; } }) as PromiseLike<object>;
    const throwingClose = Object.defineProperty({}, "then", { get() { throw closeFailure; } }) as PromiseLike<void>;
    let openCalls = 0;
    const abort = vi.fn();
    const Resource = Behavon.createResource({
      open: () => ++openCalls === 1 ? throwingOpen : {},
      close: () => throwingClose,
      abort,
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    const failedOpen = controller.open();
    expect(failedOpen.getResult()).toEqual({ status: "failed", error: openFailure });
    controller.open();
    const failedClose = controller.close();
    expect(failedClose.getResult()).toEqual({ status: "failed", error: closeFailure });
    expect(abort).toHaveBeenCalledTimes(1);
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root)[0].phase === "closed");
    root.dispose();
  });

  it("finishes close-failure cleanup and reentrant reopen before surfacing a terminal listener failure", async () => {
    const closeFailure = new Error("close failed");
    const listenerFailure = new Error("closeFailed listener failed");
    const oldResource = { id: 1 };
    const newResource = { id: 2 };
    let openCalls = 0;
    const abort = vi.fn();
    const Resource = Behavon.createResource({
      open: () => ++openCalls === 1 ? oldResource : newResource,
      close: () => { throw closeFailure; },
      abort,
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    controller.closeFailed.subscribe(() => {
      controller.open();
      throw listenerFailure;
    });
    expect(() => controller.close()).toThrow(listenerFailure);
    expect(abort).toHaveBeenCalledWith({ resource: oldResource, reason: undefined });
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root)[0].phase === "open");
    expect(openCalls).toBe(2);
    root.dispose();
  });

  it("waits for active managed actions on close and fences them on abort", async () => {
    const firstQuery = deferred<number>();
    const secondQuery = deferred<number>();
    let next = firstQuery;
    const close = vi.fn();
    const Resource = Behavon.createResource({
      open: () => ({}),
      close,
      abort: () => undefined,
      actions: { query: () => (next = next === firstQuery ? firstQuery : secondQuery).promise },
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    const pending = controller.query();
    controller.close();
    expect(close).not.toHaveBeenCalled();
    firstQuery.resolve(1);
    await expect(pending).resolves.toBe(1);
    await waitFor(() => close.mock.calls.length === 1);

    controller.open();
    next = secondQuery;
    const stale = controller.query();
    controller.abort();
    secondQuery.resolve(2);
    await expect(stale).rejects.toBeInstanceOf(ResourceActionSupersededError);
    root.dispose();
  });

  it("reserves managed actions before adapter entry so reentrant close waits for settlement", async () => {
    const pending = deferred<number>();
    const failure = new Error("sync action failed");
    const trace: string[] = [];
    const close = vi.fn(() => { trace.push("close"); });
    let requestClose!: () => unknown;
    const Resource = Behavon.createResource({
      open: () => ({}),
      close,
      abort: () => undefined,
      actions: {
        readAsync: () => {
          trace.push("async:start");
          requestClose();
          trace.push("async:return");
          return pending.promise;
        },
        readSync: () => {
          trace.push("sync:start");
          requestClose();
          trace.push("sync:return");
          return 1;
        },
        failSync: () => {
          trace.push("throw:start");
          requestClose();
          trace.push("throw:error");
          throw failure;
        },
      },
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    requestClose = () => controller.close();

    controller.open();
    const asynchronous = controller.readAsync();
    expect(trace).toEqual(["async:start", "async:return"]);
    expect(close).not.toHaveBeenCalled();
    pending.resolve(1);
    await expect(asynchronous).resolves.toBe(1);
    expect(trace).toEqual(["async:start", "async:return", "close"]);

    controller.open();
    expect(controller.readSync()).toBe(1);
    expect(trace.slice(-3)).toEqual(["sync:start", "sync:return", "close"]);

    controller.open();
    expect(() => controller.failSync()).toThrow(failure);
    expect(trace.slice(-3)).toEqual(["throw:start", "throw:error", "close"]);
    root.dispose();
  });

  it("does not let stale actions delay close after abort or native loss and reopen", async () => {
    for (const fence of ["abort", "lost"] as const) {
      const pending = deferred<number>();
      const close = vi.fn();
      let terminate!: (reason: string) => void;
      const Resource = Behavon.createResource({
        open: ({ terminated }: { terminated(reason: string): void }) => {
          terminate = terminated;
          return {};
        },
        close,
        abort: () => undefined,
        actions: { query: () => pending.promise },
      });
      function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
      const root = Behavon.createModel(Model, undefined);
      const controller = outputOf<ReturnType<typeof Model>>(root)[1];

      controller.open();
      const stale = controller.query();
      const terminateOldGeneration = terminate;
      if (fence === "abort") controller.abort("cancelled");
      else terminateOldGeneration("disconnected");

      controller.open();
      const closeRequest = controller.close("new generation");
      expect(close).toHaveBeenCalledTimes(1);
      expect(closeRequest.getResult()).toEqual({ status: "succeeded", outcome: "closed" });

      pending.resolve(1);
      await expect(stale).rejects.toBeInstanceOf(ResourceActionSupersededError);
      expect(close).toHaveBeenCalledTimes(1);
      root.dispose();
    }
  });

  it("passes an undefined resource payload to managed actions and normal close", () => {
    const close = vi.fn();
    const Resource = Behavon.createResource({
      open: () => undefined,
      close,
      abort: () => undefined,
      actions: {
        read: ({ resource }: { resource: undefined; signal: ResourceAbortSignal }) => resource,
      },
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];

    expect(controller.open().getResult()).toEqual({ status: "succeeded", outcome: "opened" });
    expect(controller.read()).toBeUndefined();
    expect(controller.close("done").getResult()).toEqual({ status: "succeeded", outcome: "closed" });
    expect(close).toHaveBeenCalledWith({ resource: undefined, reason: "done" });
    root.dispose();
  });

  it("normalizes an action then-getter failure to a tracked Promise rejection while preserving sync objects", async () => {
    const failure = new Error("action then getter failed");
    const syncValue = { value: 1, then: 1 };
    const close = vi.fn();
    const Resource = Behavon.createResource({
      open: () => ({}),
      close,
      abort: () => undefined,
      actions: {
        broken: (): PromiseLike<number> => Object.defineProperty({}, "then", { get() { throw failure; } }) as PromiseLike<number>,
        read: () => syncValue,
      },
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    const pending = controller.broken();
    expect(pending).toBeInstanceOf(Promise);
    expect(controller.read()).toBe(syncValue);
    controller.close();
    expect(close).not.toHaveBeenCalled();
    await expect(pending).rejects.toBe(failure);
    await waitFor(() => close.mock.calls.length === 1);

    controller.open();
    const fenced = controller.broken();
    controller.abort();
    await expect(fenced).rejects.toBeInstanceOf(ResourceActionSupersededError);
    root.dispose();
  });

  it("maps native termination once and ignores stale termination after abort", async () => {
    let terminate!: (reason: string) => void;
    const Resource = Behavon.createResource({
      open: ({ terminated }: { terminated(reason: string): void }) => {
        terminate = terminated;
        return {};
      },
      close: () => undefined,
      abort: () => undefined,
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    const lost: unknown[] = [];
    controller.lost.subscribe(value => lost.push(value));
    controller.open();
    terminate("network");
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root)[0].phase === "closed");
    expect(outputOf<ReturnType<typeof Model>>(root)[0]).toEqual({ phase: "closed", closedBy: "lost", reason: "network" });
    expect(lost).toHaveLength(1);
    controller.open();
    controller.abort();
    terminate("late");
    expect(lost).toHaveLength(1);
    root.dispose();
  });

  it("queues and coalesces close during opening while the first reason owns the operation", async () => {
    const opening = deferred<object>();
    const close = vi.fn();
    const Resource = Behavon.createResource({
      open: () => opening.promise,
      close: ({ reason }: { resource: object; reason?: string }) => { close(reason); },
      abort: () => undefined,
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    const closeStarted: unknown[] = [];
    controller.closeStarted.subscribe(value => closeStarted.push(value));
    controller.open();
    const first = controller.close("first");
    const second = controller.close("second");
    expect(first.execution).toBe("queued");
    expect(second.execution).toBe("coalesced");
    expect(first.operation).toBe(second.operation);
    expect(close).not.toHaveBeenCalled();
    opening.resolve({});
    await waitFor(() => close.mock.calls.length === 1);
    expect(close).toHaveBeenCalledWith("first");
    expect(closeStarted).toHaveLength(1);
    expect(first.getResult()).toEqual({ status: "succeeded", outcome: "closed" });
    expect(second.getResult()).toEqual({ status: "succeeded", outcome: "closed" });
    expect(outputOf<ReturnType<typeof Model>>(root)[0]).toEqual({ phase: "closed", closedBy: "close", reason: "first" });
    root.dispose();
  });

  it("coalesces repeated queued opens behind one async close without orphaning the first request", async () => {
    const closing = deferred<void>();
    const open = vi.fn(() => ({}));
    const Resource = Behavon.createResource({ open, close: () => closing.promise, abort: () => undefined });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    controller.close();
    const first = controller.open();
    const second = controller.open();
    expect(first.execution).toBe("queued");
    expect(second.execution).toBe("coalesced");
    expect(second.operation).toBe(first.operation);
    expect(first.getResult()).toEqual({ status: "pending" });
    expect(second.getResult()).toEqual({ status: "pending" });
    expect(open).toHaveBeenCalledTimes(1);
    closing.resolve();
    await waitFor(() => first.getResult().status === "succeeded");
    expect(second.getResult()).toEqual({ status: "succeeded", outcome: "opened" });
    expect(open).toHaveBeenCalledTimes(2);
    root.dispose();
  });

  it("does not consume a new generation queued by a closed listener", async () => {
    const firstClose = deferred<void>();
    const secondOpen = deferred<object>();
    let openCalls = 0;
    let closeCalls = 0;
    const Resource = Behavon.createResource({
      open: () => ++openCalls === 1 ? {} : secondOpen.promise,
      close: () => ++closeCalls === 1 ? firstClose.promise : undefined,
      abort: () => undefined,
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    let nestedClose: ReturnType<typeof controller.close> | undefined;
    controller.closed.subscribe(() => {
      if (openCalls === 1) {
        controller.open();
        nestedClose = controller.close("nested");
      }
    });
    controller.open();
    controller.close("outer");
    firstClose.resolve();
    await waitFor(() => openCalls === 2);
    expect(nestedClose?.getResult()).toEqual({ status: "pending" });
    secondOpen.resolve({});
    await waitFor(() => nestedClose?.getResult().status === "succeeded");
    expect(closeCalls).toBe(2);
    root.dispose();
  });

  it("does not consume a new generation queued by an openFailed listener", async () => {
    const firstOpen = deferred<object>();
    const secondOpen = deferred<object>();
    const close = vi.fn();
    let openCalls = 0;
    const Resource = Behavon.createResource({
      open: () => ++openCalls === 1 ? firstOpen.promise : secondOpen.promise,
      close,
      abort: () => undefined,
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    let nestedClose: ReturnType<typeof controller.close> | undefined;
    controller.openFailed.subscribe(() => {
      controller.open();
      nestedClose = controller.close("nested");
    });
    controller.open();
    firstOpen.reject(new Error("first open failed"));
    await waitFor(() => openCalls === 2);
    expect(nestedClose?.getResult()).toEqual({ status: "pending" });
    secondOpen.resolve({});
    await waitFor(() => nestedClose?.getResult().status === "succeeded");
    expect(close).toHaveBeenCalledTimes(1);
    root.dispose();
  });

  it("does not consume a new generation queued by a closeFailed listener", async () => {
    const firstClose = deferred<void>();
    const secondOpen = deferred<object>();
    let openCalls = 0;
    let closeCalls = 0;
    const Resource = Behavon.createResource({
      open: () => ++openCalls === 1 ? {} : secondOpen.promise,
      close: () => ++closeCalls === 1 ? firstClose.promise : undefined,
      abort: () => undefined,
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    let nestedClose: ReturnType<typeof controller.close> | undefined;
    controller.closeFailed.subscribe(() => {
      controller.open();
      nestedClose = controller.close("nested");
    });
    controller.open();
    controller.close("outer");
    firstClose.reject(new Error("first close failed"));
    await waitFor(() => openCalls === 2);
    expect(nestedClose?.getResult()).toEqual({ status: "pending" });
    secondOpen.resolve({});
    await waitFor(() => nestedClose?.getResult().status === "succeeded");
    expect(closeCalls).toBe(2);
    root.dispose();
  });

  it("lets a terminal close listener abort the queued reopen before it starts", async () => {
    const closing = deferred<void>();
    const open = vi.fn(() => ({}));
    const Resource = Behavon.createResource({ open, close: () => closing.promise, abort: () => undefined });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    controller.close();
    const reopen = controller.open();
    controller.closed.subscribe(() => { controller.abort("terminal listener"); });
    closing.resolve();
    await waitFor(() => reopen.getResult().status !== "pending");
    expect(reopen.getResult()).toEqual({ status: "superseded", by: "abort" });
    expect(open).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const snapshot = outputOf<ReturnType<typeof Model>>(root)[0];
      return snapshot.phase === "closed" && snapshot.closedBy === "abort";
    });
    root.dispose();
  });

  it("does not duplicate abort cleanup or overwrite the closed reason", async () => {
    const abort = vi.fn();
    const Resource = Behavon.createResource({
      open: () => ({}),
      close: () => undefined,
      abort,
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    const first = controller.abort("first");
    const second = controller.abort("second");
    expect(first.getResult()).toEqual({ status: "succeeded", outcome: "aborted" });
    expect(second.getResult()).toEqual({ status: "succeeded", outcome: "alreadyAborted" });
    expect(abort).toHaveBeenCalledTimes(1);
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root)[0].phase === "closed");
    expect(outputOf<ReturnType<typeof Model>>(root)[0]).toEqual({ phase: "closed", closedBy: "abort", reason: "first" });
    root.dispose();
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it("cleans up a resource that arrives after its opening operation was aborted", async () => {
    const opening = deferred<object>();
    const late = { id: "late" };
    const abort = vi.fn();
    const Resource = Behavon.createResource({ open: () => opening.promise, close: () => undefined, abort });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    controller.abort("cancel");
    opening.resolve(late);
    await waitFor(() => abort.mock.calls.length === 2);
    expect(abort.mock.calls[0]?.[0]).toEqual({ resource: undefined, reason: "cancel" });
    expect(abort.mock.calls[1]?.[0]).toEqual({ resource: late, reason: undefined });
    root.dispose();
    expect(abort).toHaveBeenCalledTimes(2);
  });

  it("routes asynchronous abort cleanup failure to the static diagnostic", async () => {
    const failure = new Error("cleanup failed");
    const cleanupErrors: unknown[] = [];
    const Resource = Behavon.createResource({
      open: () => ({}),
      close: () => undefined,
      abort: () => Promise.reject(failure),
      onCleanupError(error: unknown, context: { command: string }) {
        cleanupErrors.push([error, context.command]);
      },
    });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.open();
    controller.abort();
    await waitFor(() => cleanupErrors.length === 1);
    expect(cleanupErrors).toEqual([[failure, "abort"]]);
    root.dispose();
  });

  it("uses the latest committed input without starting work on input-only changes", async () => {
    const inputs: number[] = [];
    const Resource = Behavon.createResource({
      open: ({ input }: { input: number }) => { inputs.push(input); return {}; },
      close: () => undefined,
      abort: () => undefined,
    });
    function Model(initial: number) {
      const [input, setInput] = Behavon.useState(initial);
      const resource = Behavon.useResource(Resource, input);
      return { input, resource, setInput };
    }
    const root = Behavon.createModel(Model, 1);
    const first = outputOf<ReturnType<typeof Model>>(root);
    first.setInput(2);
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root).input === 2);
    expect(inputs).toEqual([]);
    first.resource[1].open();
    expect(inputs).toEqual([2]);
    root.dispose();
  });

  it("retains one provisional Resource through a render-phase retry until commit", () => {
    const abort = vi.fn();
    const Resource = Behavon.createResource({
      open: () => ({}),
      close: () => undefined,
      abort,
    });
    const controllers: object[] = [];
    function Model() {
      const [attempt, setAttempt] = Behavon.useState(0);
      const resource = Behavon.useResource(Resource, undefined);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records provisional identity across retry
      controllers.push(resource[1]);
      if (attempt === 0) setAttempt(1);
      return { attempt, resource };
    }

    const root = Behavon.createModel(Model, undefined);
    const output = outputOf<ReturnType<typeof Model>>(root);
    expect(output.attempt).toBe(1);
    expect(controllers).toHaveLength(2);
    expect(controllers[1]).toBe(controllers[0]);
    expect(abort).not.toHaveBeenCalled();
    expect(output.resource[1].open().getResult()).toEqual({ status: "succeeded", outcome: "opened" });
    expect(abort).not.toHaveBeenCalled();

    root.dispose();
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it("allows Effect cleanup to abort exactly once before terminal controller detachment", () => {
    const abort = vi.fn();
    const Resource = Behavon.createResource({ open: () => ({}), close: () => undefined, abort });
    let escaped!: ReturnType<typeof Model>;
    function Model() {
      const value = Behavon.useResource(Resource, undefined);
      const controller = value[1];
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a controller to inspect terminal detachment
      escaped = value;
      Behavon.useEffect(() => {
        controller.open();
        return () => { controller.abort("effect cleanup"); };
      }, [controller]);
      return value;
    }
    const root = Behavon.createModel(Model, undefined);
    const target = inspectRetainedOperationForTests(escaped[1].open);
    root.dispose();
    expect(abort).toHaveBeenCalledTimes(1);
    expect(target.owner).toBeUndefined();
    expect(target.cell).toBeUndefined();
    expect(() => escaped[1].open()).toThrow(/stale during useResource open/);
    expect(() => escaped[1].openRequested.subscribe(() => undefined)).toThrow(/stale during useResource occurrence subscription/);
  });

  it("still automatically invalidates a resource when an Effect cleanup throws", () => {
    const failure = new Error("effect cleanup failed");
    const abort = vi.fn();
    const Resource = Behavon.createResource({ open: () => ({}), close: () => undefined, abort });
    function Model() {
      const value = Behavon.useResource(Resource, undefined);
      const controller = value[1];
      Behavon.useEffect(() => {
        controller.open();
        return () => { throw failure; };
      }, [controller]);
      return value;
    }
    const root = Behavon.createModel(Model, undefined);
    expect(() => root.dispose()).toThrow(failure);
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it("propagates a started-listener failure without leaving a phantom opening lifecycle", async () => {
    const failure = new Error("listener failed");
    const open = vi.fn(() => ({}));
    const Resource = Behavon.createResource({ open, close: () => undefined, abort: () => undefined });
    function Model() { const value = Behavon.useResource(Resource, undefined); return value; }
    const root = Behavon.createModel(Model, undefined);
    const controller = outputOf<ReturnType<typeof Model>>(root)[1];
    controller.openStarted.subscribe(() => { throw failure; });
    expect(() => controller.open()).toThrow(failure);
    expect(open).not.toHaveBeenCalled();
    await waitFor(() => outputOf<ReturnType<typeof Model>>(root)[0].phase === "closed");
    expect(outputOf<ReturnType<typeof Model>>(root)[0]).toEqual({ phase: "closed", closedBy: "initial" });
    root.dispose();
  });

  it("aborts a provisional resource when construction fails after an invalid evaluation-time command", () => {
    const failure = new Error("construction failed");
    const abort = vi.fn();
    const Resource = Behavon.createResource({
      open: () => ({}),
      close: () => undefined,
      abort,
    });
    let escaped: { open(): unknown } | undefined;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    function Broken(): never {
      const value = Behavon.useResource(Resource, undefined);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- invalid reproduction verifies provisional lifecycle cleanup
      value[1].open();
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a failed-construction controller
      escaped = value[1];
      throw failure;
    }
    expect(() => Behavon.createModel(Broken, undefined)).toThrow(failure);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(() => escaped?.open()).toThrow(/stale during useResource open/);
    expect(warning).toHaveBeenCalledTimes(1);
    warning.mockRestore();
  });
});
