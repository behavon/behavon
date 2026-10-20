import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import type { DependencyProxy, Signal, Slot, SnapshotId, SnapshotRootId, UntypedModelRef } from "behavon";
import {
  acquireSnapshotFamily,
  commitSnapshotOwner,
  getFamilyNode,
  inspectSnapshotChannelCountForTests,
  inspectSnapshotChannelForTests,
  notifySnapshotNode,
  publishSnapshot,
  releaseSnapshotOwner,
} from "../../src/internal/snapshot-channels";
import { uniqueChannel, signalOf } from "../helpers";

const protocolNames = ["dispose", "then", "toJSON", "constructor"] as const;
const snapshotProtocolNames = [...protocolNames, "__proto__"] as const;

interface SnapshotEndpoints {
  readonly stage: Signal<readonly [value: number | undefined]>;
}

function createSnapshotModel(channel: SnapshotRootId<number | undefined>): UntypedModelRef {
  function SnapshotModel(): undefined {
    const [, publish] = Behavon.useSnapshot(channel);
    const stage = Behavon.useCallback((value: number | undefined) => publish(value), [publish]);
    Behavon.useSignal("stage", stage);
    return undefined;
  }
  return Behavon.createModel(SnapshotModel, undefined);
}

describe("snapshot identities", () => {
  it("does not expose the snapshot retention test seam from the package entry", () => {
    expect("inspectSnapshotChannelForTests" in Behavon).toBe(false);
  });

  it("creates one recursively frozen family with independent payload-node current and listeners", () => {
    const groupDescriptor = {
      $: Behavon.SnapshotType<{ readonly phase: string }>(),
      completed: Behavon.SnapshotType<boolean>(),
    };
    const descriptor = {
      $: Behavon.SnapshotType<number>(),
      change: Behavon.SnapshotType<string>(),
      group: groupDescriptor,
    };
    const family = Behavon.createId(descriptor);
    interface Endpoints {
      readonly root: Signal<readonly [value: number]>;
      readonly change: Signal<readonly [value: string]>;
      readonly group: Signal<readonly [phase: string]>;
      readonly complete: Signal;
    }
    function FamilyModel(): undefined {
      const [, publish] = Behavon.useSnapshot(family);
      const root = Behavon.useCallback((value: number) => publish(value), []);
      const change = Behavon.useCallback((value: string) => publish(family.change, value), []);
      const group = Behavon.useCallback((phase: string) => publish(family.group, { phase }), []);
      const complete = Behavon.useCallback(
        () => publish(family.group.completed, (previous) => !(previous ?? false)),
        [],
      );
      Behavon.useSignal("root", root);
      Behavon.useSignal("change", change);
      Behavon.useSignal("group", group);
      Behavon.useSignal("complete", complete);
      return undefined;
    }

    expect(Object.isFrozen(family)).toBe(true);
    expect(Object.isFrozen(family.change)).toBe(true);
    expect(Object.isFrozen(family.group)).toBe(true);
    expect(Object.isFrozen(family.group.completed)).toBe(true);
    expect(Object.isFrozen(descriptor)).toBe(false);
    expect(Object.isFrozen(groupDescriptor)).toBe(false);

    const model = Behavon.createModel(FamilyModel, undefined) as unknown as UntypedModelRef & Endpoints;
    const notifications = { root: 0, change: 0, group: 0, completed: 0 };
    const offRoot = Behavon.subscribe(family)(() => { notifications.root += 1; });
    const offChange = Behavon.subscribe(family.change)(() => { notifications.change += 1; });
    const offGroup = Behavon.subscribe(family.group)(() => { notifications.group += 1; });
    const offCompleted = Behavon.subscribe(family.group.completed)(() => { notifications.completed += 1; });

    signalOf(model, "change")("next");
    expect(Behavon.getSnapshot(family.change)()).toBe("next");
    expect(Behavon.getSnapshot(family)()).toBeUndefined();
    expect(notifications).toEqual({ root: 0, change: 1, group: 0, completed: 0 });

    signalOf(model, "group")("active");
    signalOf(model, "complete")();
    signalOf(model, "complete")();
    signalOf(model, "root")(1);
    signalOf(model, "root")(1);
    expect(Behavon.getSnapshot(family.group)()).toEqual({ phase: "active" });
    expect(Behavon.getSnapshot(family.group.completed)()).toBe(false);
    expect(Behavon.getSnapshot(family)()).toBe(1);
    expect(notifications).toEqual({ root: 1, change: 1, group: 1, completed: 2 });

    offRoot();
    offChange();
    offGroup();
    offCompleted();
    model.dispose();
    expect(() => Behavon.getSnapshot(family.change)).toThrow(/no live owner/);
  });

  it("supports a root-only SnapshotType identity through use, publish, and read", () => {
    const rootId = Behavon.createId(Behavon.SnapshotType<number>());
    let publish: ((value: number | undefined) => void) | undefined;
    function RootOnlyModel(): undefined {
      const [, rootPublish] = Behavon.useSnapshot(rootId);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the root-only publisher
      publish = rootPublish;
      return undefined;
    }
    const model = Behavon.createModel(RootOnlyModel, undefined);
    publish?.(4);
    expect(Behavon.getSnapshot(rootId)()).toBe(4);
    model.dispose();
  });

  it("rejects publication targets from another family at runtime", () => {
    const family = Behavon.createId({
      $: Behavon.SnapshotType<number>(),
      child: Behavon.SnapshotType<string>(),
    });
    const other = Behavon.createId({
      $: Behavon.SnapshotType<number>(),
      child: Behavon.SnapshotType<string>(),
    });
    let publish: ((target: unknown, value: unknown) => void) | undefined;
    function Model(): undefined {
      const [, familyPublish] = Behavon.useSnapshot(family);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a publisher to test runtime family validation
      publish = familyPublish as (target: unknown, value: unknown) => void;
      return undefined;
    }
    const model = Behavon.createModel(Model, undefined);
    expect(() => publish?.(other.child, "wrong")).toThrow(/different snapshot family/);
    expect(() => publish?.(family, 1)).toThrow(/publish\(value\)/);
    expect(Behavon.getSnapshot(family.child)()).toBeUndefined();
    model.dispose();
  });

  it("accepts exactly one root argument or two child arguments", () => {
    const family = Behavon.createId({
      $: Behavon.SnapshotType<number | undefined>(),
      child: Behavon.SnapshotType<string | undefined>(),
    });
    let publish: ((...args: readonly unknown[]) => void) | undefined;
    function Model(): undefined {
      const [, familyPublish] = Behavon.useSnapshot(family);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a publisher to test runtime arity validation
      publish = familyPublish as (...args: readonly unknown[]) => void;
      return undefined;
    }
    const model = Behavon.createModel(Model, undefined);

    expect(() => publish?.()).toThrow(/exactly 1 or 2 arguments/);
    expect(() => publish?.(1, 2, 3)).toThrow(/exactly 1 or 2 arguments/);
    publish?.(1);
    publish?.(undefined);
    publish?.(family.child, "value");
    publish?.(family.child, undefined);
    expect(Behavon.getSnapshot(family)()).toBeUndefined();
    expect(Behavon.getSnapshot(family.child)()).toBeUndefined();
    model.dispose();
  });

  it("keeps closed-generation nodes isolated after the same root is reopened", () => {
    const family = Behavon.createId({
      $: Behavon.SnapshotType<number>(),
      child: Behavon.SnapshotType<string>(),
    });
    const firstGeneration = acquireSnapshotFamily(family);
    commitSnapshotOwner(firstGeneration);
    const oldRootNode = getFamilyNode(firstGeneration, family);
    const oldChildNode = getFamilyNode(firstGeneration, family.child);
    let oldNotifications = 0;
    oldRootNode.subscribe(() => { oldNotifications += 1; });
    oldChildNode.subscribe(() => { oldNotifications += 1; });
    expect(publishSnapshot(oldRootNode, 1)).toBe(true);
    expect(publishSnapshot(oldChildNode, "old")).toBe(true);
    releaseSnapshotOwner(firstGeneration);

    const secondGeneration = acquireSnapshotFamily(family);
    commitSnapshotOwner(secondGeneration);
    const newRootNode = getFamilyNode(secondGeneration, family);
    const newChildNode = getFamilyNode(secondGeneration, family.child);
    let newNotifications = 0;
    newRootNode.subscribe(() => { newNotifications += 1; });
    newChildNode.subscribe(() => { newNotifications += 1; });

    expect(secondGeneration).not.toBe(firstGeneration);
    expect(newRootNode).not.toBe(oldRootNode);
    expect(newChildNode).not.toBe(oldChildNode);
    expect(publishSnapshot(oldRootNode, 2)).toBe(false);
    expect(publishSnapshot(oldChildNode, "stale")).toBe(false);
    notifySnapshotNode(oldRootNode);
    notifySnapshotNode(oldChildNode);
    expect(oldNotifications).toBe(0);
    expect(newNotifications).toBe(0);
    expect(newRootNode.current).toBeUndefined();
    expect(newChildNode.current).toBeUndefined();

    expect(publishSnapshot(newRootNode, 3)).toBe(true);
    notifySnapshotNode(newRootNode);
    expect(publishSnapshot(newChildNode, "new")).toBe(true);
    notifySnapshotNode(newChildNode);
    expect(newNotifications).toBe(2);
    expect(newRootNode.current).toBe(3);
    expect(newChildNode.current).toBe("new");
    releaseSnapshotOwner(secondGeneration);
  });

  it("retains only the authoritative current exact identity regardless of subscription", () => {
    const channel = uniqueChannel("bounded-retention");
    const versions = [1, 2, 3, 4].map((version) => ({ version }));
    let publish: ((value: { version: number } | undefined) => void) | undefined;

    function SnapshotModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, publish] = Behavon.useSnapshot(channel);
      return undefined;
    }

    const root = Behavon.createModel(SnapshotModel, undefined);
    for (const version of versions) publish?.(version);

    const unsubscribe = Behavon.subscribe(channel)(() => undefined);
    const read = Behavon.getSnapshot(channel);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(versions[3]);
    expect(read()).toBe(versions[3]);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(versions[3]);
    expect(read()).toBe(versions[3]);
    unsubscribe();
    root.dispose();
  });

  it("keeps the same current across reads and subscription changes", () => {
    const channel = uniqueChannel("subscription-independent-retention");
    let publish: ((value: number | undefined) => void) | undefined;

    function SnapshotModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, publish] = Behavon.useSnapshot(channel);
      return undefined;
    }

    const root = Behavon.createModel(SnapshotModel, undefined);
    const offFirst = Behavon.subscribe(channel)(() => undefined);
    const offSecond = Behavon.subscribe(channel)(() => undefined);
    publish?.(1);
    publish?.(2);
    publish?.(3);
    publish?.(4);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(4);

    offFirst();
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(4);
    offFirst();
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(4);

    offSecond();
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(4);
    offSecond();
    const read = Behavon.getSnapshot(channel);
    expect(read()).toBe(4);
    expect(read()).toBe(4);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(4);
    publish?.(5);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(5);
    root.dispose();
  });

  it("uses authoritative current for functional publication and Object.is bailout", () => {
    const channel = uniqueChannel("functional-retention");
    let publish: ((update: number | undefined | ((previous: number | undefined) => number | undefined)) => void) | undefined;
    const previousValues: Array<number | undefined> = [];

    function SnapshotModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, publish] = Behavon.useSnapshot(channel);
      return undefined;
    }

    const root = Behavon.createModel(SnapshotModel, undefined);
    publish?.(1);
    publish?.(2);
    publish?.(3);
    publish?.((previous) => {
      previousValues.push(previous);
      return (previous ?? 0) + 1;
    });
    publish?.(4);

    expect(previousValues).toEqual([3]);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(4);
    root.dispose();
  });

  it.each(snapshotProtocolNames)("uses the protocol-like child key %s without Proxy semantics", (name) => {
    const published = { name } as const;
    const family = Behavon.createId({
      $: Behavon.SnapshotType<undefined>(),
      [name]: Behavon.SnapshotType<typeof published>(),
    });
    const child = Object.getOwnPropertyDescriptor(family, name)?.value as SnapshotId<typeof published>;
    function SnapshotModel(): undefined {
      const [, publish] = Behavon.useSnapshot(family);
      Behavon.useEffect(
        () => (publish as unknown as (target: SnapshotId<typeof published>, value: typeof published) => void)(child, published),
        [publish],
      );
      return undefined;
    }

    const root = Behavon.createModel(SnapshotModel, undefined);
    const read = Behavon.getSnapshot(child);
    const subscribe = Behavon.subscribe(child);
    const seen: Array<typeof published | undefined> = [];
    const unsubscribe = subscribe(() => seen.push(read()));

    expect(read()).toBe(published);
    expect(Behavon.getSnapshot(child)).toBe(read);
    expect(Behavon.subscribe(child)).toBe(subscribe);
    unsubscribe();
    root.dispose();
  });

  it("rejects non-identities, namespace nodes, and child ownership", () => {
    const family = Behavon.createId({
      $: Behavon.SnapshotType<number>(),
      group: { value: Behavon.SnapshotType<number>() },
    });
    function StringIdentityModel(): undefined {
      Behavon.useSnapshot("legacy" as never);
      return undefined;
    }
    function ChildOwnerModel(): undefined {
      Behavon.useSnapshot(family.group.value as never);
      return undefined;
    }

    expect(() => Behavon.createModel(StringIdentityModel, undefined)).toThrow(/identity created by Behavon\.createId/);
    expect(() => Behavon.createModel(ChildOwnerModel, undefined)).toThrow(/root snapshot identity/);
    expect(() => Behavon.subscribe(family.group as never)).toThrow(/payload-bearing snapshot identity/);
    expect(() => Behavon.getSnapshot(family.group as never)).toThrow(/payload-bearing snapshot identity/);
  });

  it("accepts only JSON string-keyed data descriptors", () => {
    const symbol = Symbol("child");
    const symbolDescriptor = {
      $: Behavon.SnapshotType<number>(),
      [symbol]: Behavon.SnapshotType<string>(),
    };
    const accessorDescriptor = {
      $: Behavon.SnapshotType<number>(),
      get child() {
        return Behavon.SnapshotType<string>();
      },
    };
    expect(() => Behavon.createId(symbolDescriptor as never)).toThrow(/only accepts JSON string keys/);
    expect(() => Behavon.createId(accessorDescriptor as never)).toThrow(/enumerable data property/);
    expect(() => Behavon.createId({
      $: Behavon.SnapshotType<number>(),
      group: { $: undefined, value: Behavon.SnapshotType<number>() },
    } as never)).toThrow(/group\.\$.*SnapshotType/);
    expect(() => Behavon.createId({ group: { value: Behavon.SnapshotType<number>() } } as never)).toThrow(
      /root descriptor must declare a payload/,
    );
  });

  it("uses only an own enumerable data property as the $ marker", () => {
    const original = Object.getOwnPropertyDescriptor(Object.prototype, "$");
    let inheritedGetterCalls = 0;
    try {
      Object.defineProperty(Object.prototype, "$", {
        configurable: true,
        get() {
          inheritedGetterCalls += 1;
          return Behavon.SnapshotType<number>();
        },
      });
      expect(() => Behavon.createId({ child: Behavon.SnapshotType<string>() } as never)).toThrow(
        /root descriptor must declare a payload/,
      );
      expect(inheritedGetterCalls).toBe(0);

      Object.defineProperty(Object.prototype, "$", {
        configurable: true,
        value: Behavon.SnapshotType<number>(),
      });
      expect(() => Behavon.createId({ child: Behavon.SnapshotType<string>() } as never)).toThrow(
        /root descriptor must declare a payload/,
      );
    } finally {
      if (original === undefined) delete (Object.prototype as { $?: unknown }).$;
      else Object.defineProperty(Object.prototype, "$", original);
    }
  });

  it("publishes current without consuming it on read and caches accessors", () => {
    const channel = uniqueChannel("committed");
    expect("render" in Behavon).toBe(false);
    expect(() => Behavon.getSnapshot(channel)).toThrow(/no live owner/);
    expect(() => Behavon.subscribe(channel)).toThrow(/no live owner/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();

    const root = createSnapshotModel(channel);
    const read = Behavon.getSnapshot(channel);
    const subscribe = Behavon.subscribe(channel);
    expect(Behavon.getSnapshot(channel)).toBe(read);
    expect(Behavon.subscribe(channel)).toBe(subscribe);

    signalOf(root, "stage")(3);
    expect(read()).toBe(3);
    root.dispose();
    expect(() => read()).toThrow(/no live owner/);
    expect(() => subscribe(() => undefined)).toThrow(/no live owner/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("uses current for functional publication and keeps exact identity stable", () => {
    const channel = uniqueChannel("current-versions");
    let publish: ((update: { readonly version: number } | undefined | ((previous: { readonly version: number } | undefined) => { readonly version: number })) => void) | undefined;
    const first = { version: 1 } as const;
    const second = { version: 2 } as const;
    const previousValues: Array<{ readonly version: number } | undefined> = [];
    let notifications = 0;

    function SnapshotModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, publish] = Behavon.useSnapshot(channel);
      return undefined;
    }

    const root = Behavon.createModel(SnapshotModel, undefined);
    const unsubscribe = Behavon.subscribe(channel)(() => {
      notifications += 1;
    });
    publish?.(first);
    publish?.((previous) => {
      previousValues.push(previous);
      return second;
    });

    expect(previousValues).toEqual([first]);
    expect(notifications).toBe(2);
    const read = Behavon.getSnapshot(channel);
    expect(read()).toBe(second);
    expect(read()).toBe(second);

    unsubscribe();
    root.dispose();
  });

  it("gives same-token readers one exact current identity", () => {
    const channel = uniqueChannel("shared-current");
    const published = { version: 1 } as const;
    let publish: ((value: typeof published | undefined) => void) | undefined;
    function SnapshotModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, publish] = Behavon.useSnapshot(channel);
      return undefined;
    }
    const root = Behavon.createModel(SnapshotModel, undefined);
    const read = Behavon.getSnapshot(channel);
    const seen: Array<typeof published | undefined> = [];
    const offFirst = Behavon.subscribe(channel)(() => seen.push(read()));
    const offSecond = Behavon.subscribe(channel)(() => seen.push(read()));

    publish?.(published);

    expect(seen[0]).toBe(published);
    expect(seen[1]).toBe(published);
    expect(read()).toBe(published);
    offFirst();
    offSecond();
    root.dispose();
  });

  it("returns the same current whether subscription happens before or after the first read", () => {
    const channel = uniqueChannel("subscribe-read-order");
    const root = createSnapshotModel(channel);
    const readFirst = Behavon.getSnapshot(channel);

    signalOf(root, "stage")(1);
    const beforeSubscribe = readFirst();
    const offFirst = Behavon.subscribe(channel)(() => undefined);
    const afterSubscribe = readFirst();
    offFirst();

    const offSecond = Behavon.subscribe(channel)(() => undefined);
    const readAfterSubscribe = Behavon.getSnapshot(channel)();
    offSecond();

    expect(beforeSubscribe).toBe(afterSubscribe);
    expect(readAfterSubscribe).toBe(afterSubscribe);
    root.dispose();
  });

  it("changes current only on changed publication", () => {
    const channel = uniqueChannel("publication-only-version-change");
    const root = createSnapshotModel(channel);
    const read = Behavon.getSnapshot(channel);

    signalOf(root, "stage")(1);
    const afterFirstPublish = inspectSnapshotChannelForTests(channel)?.current;
    read();
    read();
    const off = Behavon.subscribe(channel)(() => undefined);
    read();
    off();
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(afterFirstPublish);

    signalOf(root, "stage")(1);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(afterFirstPublish);
    signalOf(root, "stage")(2);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(2);
    root.dispose();
  });

  it("keeps the latest current when a listener publishes reentrantly", () => {
    const channel = uniqueChannel("reentrant-latest-wins");
    const root = createSnapshotModel(channel);
    const read = Behavon.getSnapshot(channel);
    const trace: number[] = [];
    const unsubscribe = Behavon.subscribe(channel)(() => {
      const current = read();
      trace.push(current ?? -1);
      if (current === 1) signalOf(root, "stage")(2);
    });

    signalOf(root, "stage")(1);

    expect(trace).toEqual([1, 2]);
    expect(read()).toBe(2);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(2);
    unsubscribe();
    root.dispose();
  });

  it("accepts publications to one channel from different roots", () => {
    const channel = uniqueChannel("shared-publication");
    const first = createSnapshotModel(channel);
    const second = createSnapshotModel(channel);
    expect(inspectSnapshotChannelForTests(channel)?.ownerCount).toBe(2);
    signalOf(first, "stage")(1);
    expect(Behavon.getSnapshot(channel)()).toBe(1);
    signalOf(second, "stage")(2);
    expect(Behavon.getSnapshot(channel)()).toBe(2);
    first.dispose();
    expect(inspectSnapshotChannelForTests(channel)?.ownerCount).toBe(1);
    signalOf(second, "stage")(3);
    expect(Behavon.getSnapshot(channel)()).toBe(3);
    second.dispose();
    expect(() => Behavon.getSnapshot(channel)).toThrow(/no live owner/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("lets the tuple and top-level getter observe the same current", () => {
    const channel = uniqueChannel("tuple-current");
    const sourceModel = createSnapshotModel(channel);
    const seen: Array<number | undefined> = [];

    function Reader(): undefined {
      const [snapshot] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      seen.push(snapshot);
      return undefined;
    }

    signalOf(sourceModel, "stage")(7);
    const reader = Behavon.createModel(Reader, undefined);
    expect(seen).toEqual([7]);
    expect(Behavon.getSnapshot(channel)()).toBe(7);
    reader.dispose();
    sourceModel.dispose();
  });

  it("does not mutate or notify a channel when a model is disposed", () => {
    const channel = uniqueChannel("dispose-does-not-publish");
    const calls: string[] = [];
    const root = createSnapshotModel(channel);
    const read = Behavon.getSnapshot(channel);
    const unsubscribe = Behavon.subscribe(channel)(() => calls.push("changed"));
    signalOf(root, "stage")(4);
    calls.length = 0;
    root.dispose();
    expect(calls).toEqual([]);
    expect(() => read()).toThrow(/no live owner/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
    expect(() => unsubscribe()).not.toThrow();
  });

  it("uses independent records and a notification-start snapshot", () => {
    const channel = uniqueChannel("subscriber-records");
    const root = createSnapshotModel(channel);
    const trace: string[] = [];
    const shared = () => trace.push("shared");
    const unsubscribeFirst = Behavon.subscribe(channel)(shared);
    let unsubscribeSecond: () => void = () => undefined;
    let unsubscribeLate: (() => void) | undefined;
    const unsubscribeController = Behavon.subscribe(channel)(() => {
      trace.push("controller");
      unsubscribeSecond();
      unsubscribeLate ??= Behavon.subscribe(channel)(() => trace.push("late"));
    });
    unsubscribeSecond = Behavon.subscribe(channel)(shared);

    signalOf(root, "stage")(1);
    expect(trace).toEqual(["shared", "controller"]);

    trace.length = 0;
    signalOf(root, "stage")(2);
    expect(trace).toEqual(["shared", "controller", "late"]);

    unsubscribeFirst();
    unsubscribeController();
    unsubscribeLate?.();
    root.dispose();
  });

  it("keeps current when a listener reads then throws and stops siblings", () => {
    const channel = uniqueChannel("subscriber-error");
    const published = { version: 1 } as const;
    let publish: ((value: typeof published | undefined) => void) | undefined;
    function SnapshotModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, publish] = Behavon.useSnapshot(channel);
      return undefined;
    }
    const root = Behavon.createModel(SnapshotModel, undefined);
    const failure = new Error("listener failed");
    const trace: string[] = [];
    const read = Behavon.getSnapshot(channel);
    const offFirst = Behavon.subscribe(channel)(() => {
      trace.push("first");
      expect(read()).toBe(published);
      throw failure;
    });
    const offSecond = Behavon.subscribe(channel)(() => trace.push("second"));
    expect(() => publish?.(published)).toThrow(failure);
    expect(trace).toEqual(["first"]);
    expect(read()).toBe(published);
    offFirst();
    offSecond();
    root.dispose();
  });

  it("does not revive a disposed owner through captured setters", () => {
    const channel = uniqueChannel("stale-setter");
    let setState: ((value: number | ((previous: number) => number)) => void) | undefined;
    let publishSnapshot: ((value: number | undefined | ((previous: number | undefined) => number | undefined)) => void) | undefined;

    function Model(): undefined {
      const [, set] = Behavon.useState(0);
      const [, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      setState = set;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      publishSnapshot = publish;
      return undefined;
    }

    const root = Behavon.createModel(Model, undefined);
    root.dispose();
    expect(() => setState?.(1)).not.toThrow();
    expect(() => publishSnapshot?.(2)).not.toThrow();
    expect(() => Behavon.getSnapshot(channel)).toThrow(/no live owner/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();

    const replacement = createSnapshotModel(channel);
    signalOf(replacement, "stage")(3);
    publishSnapshot?.(4);
    expect(Behavon.getSnapshot(channel)()).toBe(3);
    replacement.dispose();
  });

  it("uses current for functional publish and bails out with Object.is", () => {
    const channel = uniqueChannel("functional-publish");
    let publish: ((update: number | undefined | ((previous: number | undefined) => number | undefined)) => void) | undefined;
    let notifications = 0;

    function SnapshotModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, publish] = Behavon.useSnapshot(channel);
      return undefined;
    }

    const root = Behavon.createModel(SnapshotModel, undefined);
    const unsubscribe = Behavon.subscribe(channel)(() => {
      notifications += 1;
    });
    publish?.(1);
    publish?.((previous) => (previous ?? 0) + 1);
    publish?.(2);
    expect(Behavon.getSnapshot(channel)()).toBe(2);
    expect(notifications).toBe(2);
    unsubscribe();
    root.dispose();
  });

  it("physically removes listeners and keeps unsubscribe idempotent", () => {
    const channel = uniqueChannel("listener-release");
    const root = createSnapshotModel(channel);
    const unsubscribe = Behavon.subscribe(channel)(() => undefined);
    expect(inspectSnapshotChannelForTests(channel)?.listenerCount).toBe(1);
    unsubscribe();
    expect(inspectSnapshotChannelForTests(channel)?.listenerCount).toBe(0);
    unsubscribe();
    expect(inspectSnapshotChannelForTests(channel)?.listenerCount).toBe(0);
    root.dispose();
  });

  it("does not attach stale capabilities to a later same-name lifetime", () => {
    const channel = uniqueChannel("new-lifetime");
    const first = createSnapshotModel(channel);
    const oldRead = Behavon.getSnapshot(channel);
    const oldSubscribe = Behavon.subscribe(channel);
    signalOf(first, "stage")(1);
    first.dispose();

    const second = createSnapshotModel(channel);
    const newRead = Behavon.getSnapshot(channel);
    const newSubscribe = Behavon.subscribe(channel);
    expect(newRead).not.toBe(oldRead);
    expect(newSubscribe).not.toBe(oldSubscribe);
    expect(() => oldRead()).toThrow(/no live owner/);
    expect(() => oldSubscribe(() => undefined)).toThrow(/no live owner/);
    expect(newRead()).toBeUndefined();
    signalOf(second, "stage")(2);
    expect(newRead()).toBe(2);
    second.dispose();
  });

  it("keeps stale root and child publishers, accessors, and listeners out of a reopened generation", () => {
    const family = Behavon.createId({
      $: Behavon.SnapshotType<number>(),
      child: Behavon.SnapshotType<string>(),
    });
    let oldPublish: ((...args: readonly unknown[]) => void) | undefined;
    function First(): undefined {
      const [, publish] = Behavon.useSnapshot(family);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a publisher across owner generations
      oldPublish = publish as (...args: readonly unknown[]) => void;
      return undefined;
    }
    const first = Behavon.createModel(First, undefined);
    const oldRootRead = Behavon.getSnapshot(family);
    const oldChildRead = Behavon.getSnapshot(family.child);
    const oldRootSubscribe = Behavon.subscribe(family);
    const oldChildSubscribe = Behavon.subscribe(family.child);
    let oldNotifications = 0;
    oldRootSubscribe(() => { oldNotifications += 1; });
    oldChildSubscribe(() => { oldNotifications += 1; });
    oldPublish?.(1);
    oldPublish?.(family.child, "old");
    expect(oldNotifications).toBe(2);
    first.dispose();

    let newPublish: ((...args: readonly unknown[]) => void) | undefined;
    function Second(): undefined {
      const [, publish] = Behavon.useSnapshot(family);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains the replacement generation publisher
      newPublish = publish as (...args: readonly unknown[]) => void;
      return undefined;
    }
    const second = Behavon.createModel(Second, undefined);
    const newRootRead = Behavon.getSnapshot(family);
    const newChildRead = Behavon.getSnapshot(family.child);
    let newNotifications = 0;
    const offNewRoot = Behavon.subscribe(family)(() => { newNotifications += 1; });
    const offNewChild = Behavon.subscribe(family.child)(() => { newNotifications += 1; });
    let staleUpdaterCalls = 0;
    oldPublish?.(() => {
      staleUpdaterCalls += 1;
      return 2;
    });
    oldPublish?.(family.child, () => {
      staleUpdaterCalls += 1;
      return "stale";
    });

    expect(staleUpdaterCalls).toBe(0);
    expect(() => oldRootRead()).toThrow(/no live owner/);
    expect(() => oldChildRead()).toThrow(/no live owner/);
    expect(() => oldRootSubscribe(() => undefined)).toThrow(/no live owner/);
    expect(() => oldChildSubscribe(() => undefined)).toThrow(/no live owner/);
    expect(newRootRead()).toBeUndefined();
    expect(newChildRead()).toBeUndefined();
    expect(newNotifications).toBe(0);

    newPublish?.(3);
    newPublish?.(family.child, "new");
    expect(newRootRead()).toBe(3);
    expect(newChildRead()).toBe("new");
    expect(newNotifications).toBe(2);
    expect(oldNotifications).toBe(2);
    offNewRoot();
    offNewChild();
    second.dispose();
  });

  it.each(["root", "child"] as const)(
    "does not commit an old %s updater after it disposes the last owner and reopens the root",
    (target) => {
      const family = Behavon.createId({
        $: Behavon.SnapshotType<number>(),
        child: Behavon.SnapshotType<string>(),
      });
      const openGeneration = (): Readonly<{
        owner: UntypedModelRef;
        publish: (...args: readonly unknown[]) => void;
      }> => {
        let retainedPublish: ((...args: readonly unknown[]) => void) | undefined;
        function Writer(): undefined {
          const [, publish] = Behavon.useSnapshot(family);
          // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a publisher across a reentrant generation replacement
          retainedPublish = publish as (...args: readonly unknown[]) => void;
          return undefined;
        }
        const owner = Behavon.createModel(Writer, undefined);
        if (retainedPublish === undefined) throw new Error("publisher was not captured");
        return { owner, publish: retainedPublish };
      };

      const oldGeneration = openGeneration();
      oldGeneration.publish(1);
      oldGeneration.publish(family.child, "old");
      const oldRootRead = Behavon.getSnapshot(family);
      const oldChildRead = Behavon.getSnapshot(family.child);
      let oldNotifications = 0;
      Behavon.subscribe(family)(() => { oldNotifications += 1; });
      Behavon.subscribe(family.child)(() => { oldNotifications += 1; });

      let newGeneration: ReturnType<typeof openGeneration> | undefined;
      let newRootRead: (() => number | undefined) | undefined;
      let newChildRead: (() => string | undefined) | undefined;
      let newNotifications = 0;
      const replaceGeneration = (): void => {
        oldGeneration.owner.dispose();
        newGeneration = openGeneration();
        newRootRead = Behavon.getSnapshot(family);
        newChildRead = Behavon.getSnapshot(family.child);
        Behavon.subscribe(family)(() => { newNotifications += 1; });
        Behavon.subscribe(family.child)(() => { newNotifications += 1; });
        newGeneration.publish(100);
        newGeneration.publish(family.child, "new");
      };

      if (target === "root") {
        oldGeneration.publish((previous: number | undefined) => {
          expect(previous).toBe(1);
          replaceGeneration();
          return 2;
        });
      } else {
        oldGeneration.publish(family.child, (previous: string | undefined) => {
          expect(previous).toBe("old");
          replaceGeneration();
          return "stale";
        });
      }

      expect(() => oldRootRead()).toThrow(/no live owner/);
      expect(() => oldChildRead()).toThrow(/no live owner/);
      expect(oldNotifications).toBe(0);
      expect(newRootRead?.()).toBe(100);
      expect(newChildRead?.()).toBe("new");
      expect(newNotifications).toBe(2);
      newGeneration?.owner.dispose();
    },
  );

  it("closes the last live owner record even when another transaction holds a provisional lease", () => {
    const channel = uniqueChannel("provisional-does-not-extend-lifetime");
    const firstValue = { lifetime: 1 } as const;
    const secondValue = { lifetime: 2 } as const;
    let firstPublish: ((value: typeof firstValue | undefined) => void) | undefined;
    let provisionalPublish: ((value: typeof firstValue | undefined) => void) | undefined;
    let secondPublish: ((value: typeof secondValue | undefined) => void) | undefined;
    let provisionalRead: typeof firstValue | undefined;

    function First(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, firstPublish] = Behavon.useSnapshot(channel);
      return undefined;
    }
    const first = Behavon.createModel(First, undefined);
    firstPublish?.(firstValue);
    const oldRead = Behavon.getSnapshot(channel);
    const oldSubscribe = Behavon.subscribe(channel);

    function Provisional(): undefined {
      const [snapshot, publish] = Behavon.useSnapshot(channel);
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      provisionalRead = snapshot;
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      provisionalPublish = publish;
      first.dispose();
      return undefined;
    }

    expect(() => Behavon.createModel(Provisional, undefined)).toThrow(
      /no provisional owner to commit|closed/,
    );
    expect(provisionalRead).toBe(firstValue);
    expect(() => oldRead()).toThrow(/no live owner/);
    expect(() => oldSubscribe(() => undefined)).toThrow(/no live owner/);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
    expect(() => provisionalPublish?.(firstValue)).not.toThrow();
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();

    function Second(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, secondPublish] = Behavon.useSnapshot(channel);
      return undefined;
    }
    const second = Behavon.createModel(Second, undefined);
    const newRead = Behavon.getSnapshot(channel);
    const newSubscribe = Behavon.subscribe(channel);
    expect(newRead).not.toBe(oldRead);
    expect(newSubscribe).not.toBe(oldSubscribe);
    expect(newRead()).toBeUndefined();
    secondPublish?.(secondValue);
    expect(newRead()).toBe(secondValue);
    second.dispose();
  });

  it("does not accumulate registry entries across unique owner lifetimes", () => {
    const baseline = inspectSnapshotChannelCountForTests();
    for (let index = 0; index < 20; index += 1) {
      const root = createSnapshotModel(uniqueChannel(`bounded-registry-${index}`));
      root.dispose();
    }
    expect(inspectSnapshotChannelCountForTests()).toBe(baseline);
  });

  it("counts one lifecycle owner when one Model declares the same channel twice", () => {
    const channel = uniqueChannel("duplicate-declaration-owner");
    function Model(): undefined {
      Behavon.useSnapshot(channel);
      Behavon.useSnapshot(channel);
      return undefined;
    }
    const root = Behavon.createModel(Model, undefined);
    expect(inspectSnapshotChannelForTests(channel)?.ownerCount).toBe(1);
    root.dispose();
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("releases the channel even when user cleanup throws during dispose", () => {
    const channel = uniqueChannel("cleanup-error-release");
    const failure = new Error("cleanup failed");
    function Model(): undefined {
      Behavon.useSnapshot(channel);
      Behavon.useEffect(() => () => {
        throw failure;
      }, []);
      return undefined;
    }
    const root = Behavon.createModel(Model, undefined);
    expect(() => root.dispose()).toThrow(failure);
    expect(inspectSnapshotChannelForTests(channel)).toBeUndefined();
  });

  it("leaves current and notifications unchanged when a functional updater throws", () => {
    const channel = uniqueChannel("functional-publish-error");
    const first = { version: 1 } as const;
    const failure = new Error("functional updater failed");
    let publish: ((update: typeof first | undefined | ((previous: typeof first | undefined) => typeof first)) => void) | undefined;
    let notifications = 0;

    function SnapshotModel(): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe retains a Hook result or records synchronous evaluation behavior
      [, publish] = Behavon.useSnapshot(channel);
      return undefined;
    }

    const root = Behavon.createModel(SnapshotModel, undefined);
    const unsubscribe = Behavon.subscribe(channel)(() => {
      notifications += 1;
    });
    publish?.(first);
    const currentBeforeFailure = inspectSnapshotChannelForTests(channel)?.current;
    expect(() => publish?.(() => {
      throw failure;
    })).toThrow(failure);
    expect(notifications).toBe(1);
    expect(Behavon.getSnapshot(channel)()).toBe(first);
    expect(inspectSnapshotChannelForTests(channel)?.current).toBe(currentBeforeFailure);

    unsubscribe();
    root.dispose();
  });
});

describe("Proxy safety and interface reflection", () => {
  interface Surface {
    readonly alpha: Signal<readonly [value: number]>;
    readonly shared: Signal & Slot;
  }

  it("fails fast when usePort receives null at runtime", () => {
    function InvalidDependency(): undefined {
      const invalidRef: UntypedModelRef = null as any;
      const dependency = Behavon.usePort(invalidRef);
      const unreachable = dependency.unreachableEndpoint;
      void unreachable;
      return undefined;
    }

    expect(() => Behavon.createModel(InvalidDependency, undefined)).toThrow(
      /Behavon\.usePort requires a live Model instance/,
    );
  });

  it("describes the same active registry from a ref and dependency Proxy", () => {
    let proxy: DependencyProxy | undefined;

    function Target(): undefined {
      const alpha = Behavon.useCallback((_value: number) => undefined, []);
      const first = Behavon.useCallback(() => undefined, []);
      const second = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal("alpha", alpha);
      Behavon.useSignal("shared", first);
      Behavon.useSignal("shared", second);
      Behavon.useSlot("shared", first);
      return undefined;
    }

    const target = Behavon.createModel(Target, undefined);

    function Inspector(input: UntypedModelRef): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      proxy = Behavon.usePort(input);
      return undefined;
    }

    const inspector = Behavon.createModel(Inspector, target);
    const expected = {
      endpoints: [
        { name: "alpha", signalRegistrations: 1, slotRegistrations: 0 },
        { name: "shared", signalRegistrations: 2, slotRegistrations: 1 },
      ],
    };
    expect(Behavon.getInterface(target)).toEqual(expected);
    expect(proxy).toBeDefined();
    expect(Behavon.getInterface(proxy as NonNullable<typeof proxy>)).toEqual(expected);

    const mutableCopy = Behavon.getInterface(target) as {
      endpoints: Array<{ name: string; signalRegistrations: number; slotRegistrations: number }>;
    };
    try {
      mutableCopy.endpoints.length = 0;
    } catch {
      // Runtime freezing is allowed but not required.
    }
    expect(Behavon.getInterface(target)).toEqual(expected);
    inspector.dispose();
    target.dispose();
    expect(() => Behavon.getInterface(target)).toThrow();
    expect(() => Behavon.getInterface({} as never)).toThrow();
  });

  it.each(protocolNames)("rejects the reserved endpoint name %s", (name) => {
    function InvalidSignal(): undefined {
      const callback = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal(name, callback);
      return undefined;
    }
    function InvalidSlot(): undefined {
      const callback = Behavon.useCallback(() => undefined, []);
      Behavon.useSlot(name, callback);
      return undefined;
    }
    expect(() => Behavon.createModel(InvalidSignal, undefined)).toThrow();
    expect(() => Behavon.createModel(InvalidSlot, undefined)).toThrow();
  });

  it("requires non-empty string endpoint names", () => {
    function EmptySignal(): undefined {
      const callback = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal("", callback);
      return undefined;
    }
    function NonStringSlot(): undefined {
      const callback = Behavon.useCallback(() => undefined, []);
      Behavon.useSlot(42 as unknown as string, callback);
      return undefined;
    }

    expect(() => Behavon.createModel(EmptySignal, undefined)).toThrow(/non-empty string/);
    expect(() => Behavon.createModel(NonStringSlot, undefined)).toThrow(/non-empty string/);
  });

  it("handles Promise, serialization and symbols without treating them as endpoints", async () => {
    let proxy: ReturnType<typeof Behavon.usePort> | undefined;

    function Target(): undefined {
      const event = Behavon.useCallback(() => undefined, []);
      Behavon.useSignal("event", event);
      return undefined;
    }

    const target = Behavon.createModel(Target, undefined);
    function Inspector(input: UntypedModelRef): undefined {
      // eslint-disable-next-line behavon-hooks/evaluation-purity -- test-only probe records evaluation or dispatch behavior outside supported authoring
      proxy = Behavon.usePort(input);
      return undefined;
    }
    const inspector = Behavon.createModel(Inspector, target);
    const dependency = proxy as NonNullable<typeof proxy>;
    await expect(Promise.resolve(dependency)).resolves.toBe(dependency);
    expect(() => JSON.stringify(dependency)).not.toThrow();
    expect(() => Reflect.get(dependency, Symbol.toStringTag)).not.toThrow();
    expect(() => dependency.unknownApplicationEndpoint).toThrow();
    inspector.dispose();
    target.dispose();
  });

  it("does not turn a typed schema declaration into a runtime endpoint", () => {
    interface DeclaredOnlySurface {
      readonly missing: Signal<readonly []>;
    }

    function Target(): undefined {
      return undefined;
    }

    const target = Behavon.createModel(
      Target,
      undefined,
    );
    function Inspector(input: UntypedModelRef): undefined {
      // eslint-disable-next-line behavon-hooks/canonical-api -- missing-endpoint probe consumes the proxy through its throwing property lookup
      const dependency = Behavon.usePort(input);
      dependency.missing;
      return undefined;
    }

    expect(() => Behavon.createModel(Inspector, target)).toThrow(/has no endpoint 'missing'/);
    target.dispose();
  });
});
