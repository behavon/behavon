import { describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import type { Model, ModelInstance, Signal, Slot, TransactionAccess, TransactionId } from "behavon";
import { inspectModelInstanceForTests } from "../../src/internal/model-inspection";
import { inspectMutableStateForTests, type MutableStateSubject } from "../../src/internal/mutable-observer";
import { waitFor } from "../helpers";

function outputOf<Value>(instance: object): Value {
  return inspectModelInstanceForTests(instance).output as Value;
}

describe("labeled transactions", () => {
  it("activates all labeled state only at the outer commit", () => {
    interface Port {
      execute: Signal;
    }
    const port = Behavon.createPort<Port>({ execute: Behavon.SignalType() });
    const states = Behavon.createId({
      first: Behavon.StateType<number>(),
      second: Behavon.StateType<number>(),
    });
    const observations: Array<readonly [number, number]> = [];

    const Model: Model<undefined, readonly [number, number], Port> = () => {
      const [first] = Behavon.useLabelState(states.first, 0);
      const [second] = Behavon.useLabelState(states.second, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.first, states.second]);
        Behavon.transaction.run(id, ({ set }) => {
          set(states.first, 1);
          set(states.second, 2);
          observations.push(outputOf<readonly [number, number]>(instance as object));
        });
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(port, "execute", execute);
      Behavon.useExport(port, "execute");
      return [first, second] as const;
    };

    const instance = Behavon.createModel(Model, undefined);
    instance.execute();
    expect(observations).toEqual([[0, 0]]);
    expect(outputOf(instance as object)).toEqual([1, 2]);
    instance.dispose();
  });

  it("rolls back the escaping run scope and preserves the original error", () => {
    const failure = new Error("transaction failed");
    interface Port {
      fail: Signal;
    }
    const port = Behavon.createPort<Port>({ fail: Behavon.SignalType() });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value] = Behavon.useLabelState(states.value, 0);
      const fail = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        Behavon.transaction.run(id, ({ set }) => {
          set(states.value, 1);
          throw failure;
        });
      }, []);
      Behavon.useSignal(port, "fail", fail);
      Behavon.useExport(port, "fail");
      return value;
    };
    const instance = Behavon.createModel(Model, undefined);
    expect(() => instance.fail()).toThrow(failure);
    expect(outputOf(instance as object)).toBe(0);
    instance.dispose();
  });

  it("fails fast when a different root relocks the same concrete StateId", () => {
    interface Port {
      open: Signal;
      conflict: Signal;
      cancel: Signal;
    }
    const port = Behavon.createPort<Port>({
      open: Behavon.SignalType(),
      conflict: Behavon.SignalType(),
      cancel: Behavon.SignalType(),
    });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value] = Behavon.useLabelState(states.value, 0);
      const active = Behavon.useMutable<TransactionId | undefined>(undefined);
      const open = Behavon.useCallback(() => {
        const id = Behavon.createId();
        active.set(id);
        Behavon.transaction.start(id, [states.value]);
      }, []);
      const conflict = Behavon.useCallback(() => {
        const other = Behavon.createId();
        Behavon.transaction.start(other, [states.value]);
      }, []);
      const cancel = Behavon.useCallback(() => {
        const id = active.get();
        if (id !== undefined) Behavon.transaction.rollback(id);
      }, []);
      Behavon.useSignal(port, "open", open);
      Behavon.useExport(port, "open");
      Behavon.useSignal(port, "conflict", conflict);
      Behavon.useExport(port, "conflict");
      Behavon.useSignal(port, "cancel", cancel);
      Behavon.useExport(port, "cancel");
      return value;
    };
    const instance = Behavon.createModel(Model, undefined);
    instance.open();
    expect(() => instance.conflict()).toThrow(/relock a StateId held by another root/);
    instance.cancel();
    instance.dispose();
  });

  it("queues an external labeled setter until rollback releases its lock", async () => {
    interface Port {
      open: Signal;
      externalSet: Signal<[value: number]>;
      cancel: Signal;
    }
    const port = Behavon.createPort<Port>({
      open: Behavon.SignalType(),
      externalSet: Behavon.SignalType(),
      cancel: Behavon.SignalType(),
    });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value, setValue] = Behavon.useLabelState(states.value, 0);
      const active = Behavon.useMutable<TransactionId | undefined>(undefined);
      const open = Behavon.useCallback(() => {
        const id = Behavon.createId();
        active.set(id);
        Behavon.transaction.start(id, [states.value]);
      }, []);
      const externalSet = Behavon.useCallback((next: number) => setValue(next), [setValue]);
      const cancel = Behavon.useCallback(() => {
        const id = active.get();
        if (id !== undefined) Behavon.transaction.rollback(id);
      }, []);
      Behavon.useSignal(port, "open", open);
      Behavon.useExport(port, "open");
      Behavon.useSignal(port, "externalSet", externalSet);
      Behavon.useExport(port, "externalSet");
      Behavon.useSignal(port, "cancel", cancel);
      Behavon.useExport(port, "cancel");
      return value;
    };
    const instance = Behavon.createModel(Model, undefined);
    instance.open();
    instance.externalSet(7);
    expect(outputOf(instance as object)).toBe(0);
    instance.cancel();
    await waitFor(() => outputOf(instance as object) === 7);
    instance.dispose();
  });

  it("rejects thenable run bodies and rolls their scope back", () => {
    interface Port {
      execute: Signal;
    }
    const port = Behavon.createPort<Port>({ execute: Behavon.SignalType() });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value] = Behavon.useLabelState(states.value, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        const asyncBody = (async ({ set }: TransactionAccess) => {
          set(states.value, 1);
        }) as unknown as () => void;
        Behavon.transaction.run(id, asyncBody);
      }, []);
      Behavon.useSignal(port, "execute", execute);
      Behavon.useExport(port, "execute");
      return value;
    };
    const instance = Behavon.createModel(Model, undefined);
    expect(() => instance.execute()).toThrow(/requires a synchronous body/);
    expect(outputOf(instance as object)).toBe(0);
    instance.dispose();
  });

  it("fails fast when a labeled setter was omitted from the active lock list", () => {
    interface Port {
      execute: Signal;
    }
    const port = Behavon.createPort<Port>({ execute: Behavon.SignalType() });
    const states = Behavon.createId({
      first: Behavon.StateType<number>(),
      second: Behavon.StateType<number>(),
    });
    const Model: Model<undefined, readonly [number, number], Port> = () => {
      const [first] = Behavon.useLabelState(states.first, 0);
      const [second] = Behavon.useLabelState(states.second, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.first]);
        Behavon.transaction.run(id, ({ set }) => set(states.second, 1));
      }, []);
      Behavon.useSignal(port, "execute", execute);
      Behavon.useExport(port, "execute");
      return [first, second] as const;
    };
    const instance = Behavon.createModel(Model, undefined);
    expect(() => instance.execute()).toThrow(/requires a StateId locked by this transaction\.start/);
    expect(outputOf(instance as object)).toEqual([0, 0]);
    instance.dispose();
  });

  it("rolls back and unlocks an open root when its owner is disposed", () => {
    interface Port {
      open: Signal;
    }
    const port = Behavon.createPort<Port>({ open: Behavon.SignalType() });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value] = Behavon.useLabelState(states.value, 0);
      const open = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        Behavon.transaction.run(id, ({ set }) => set(states.value, 1));
      }, []);
      Behavon.useSignal(port, "open", open);
      Behavon.useExport(port, "open");
      return value;
    };
    const instance = Behavon.createModel(Model, undefined);
    const cell = inspectModelInstanceForTests(instance as object).hooks.find(
      (hook) => (hook as { kind?: string }).kind === "state",
    ) as MutableStateSubject;
    instance.open();
    expect(inspectMutableStateForTests(cell).locked).toBe(true);
    instance.dispose();
    expect(inspectMutableStateForTests(cell)).toMatchObject({ status: "released", locked: false });
  });

  it("prepares touched observation dependencies before one multi-Model activation", () => {
    interface ChildPort {
      add: Signal<[amount: number]>;
    }
    interface ParentPort {
      execute: Signal;
    }
    const childPort = Behavon.createPort<ChildPort>({ add: Behavon.SignalType() });
    const parentPort = Behavon.createPort<ParentPort>({ execute: Behavon.SignalType() });
    const childStates = Behavon.createId({ value: Behavon.StateType<number>() });
    const parentStates = Behavon.createId({ value: Behavon.StateType<number>() });
    const Child: Model<undefined, number, ChildPort> = () => {
      const [value] = Behavon.useLabelState(childStates.value, 0);
      const add = Behavon.useCallback((amount: number) => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [childStates.value]);
        Behavon.transaction.run(id, ({ set }) => set(childStates.value, (previous) => previous + amount));
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(childPort, "add", add);
      Behavon.useExport(childPort, "add");
      return value;
    };
    const Parent: Model<{
      child: ModelInstance<undefined, number, ChildPort>;
    }, number, ParentPort> = (input) => {
      const child = input.child;
      const [childValue] = Behavon.useModel(child);
      const [value] = Behavon.useLabelState(parentStates.value, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [parentStates.value]);
        Behavon.transaction.run(id, ({ set }) => {
          set(parentStates.value, 1);
          child.add(2);
        });
        Behavon.transaction.commit(id);
      }, [child]);
      Behavon.useSignal(parentPort, "execute", execute);
      Behavon.useExport(parentPort, "execute");
      return value + childValue;
    };
    const child = Behavon.createModel(Child, undefined);
    const parent = Behavon.createModel(Parent, { child });
    parent.execute();
    expect(outputOf(child as object)).toBe(2);
    expect(outputOf(parent as object)).toBe(3);
    parent.dispose();
    child.dispose();
  });

  it("treats the same raw TransactionId as independent lifecycle identity in different Models", () => {
    interface Port {
      open: Signal<[amount: number]>;
      finish: Signal;
    }
    const port = Behavon.createPort<Port>({
      open: Behavon.SignalType(),
      finish: Behavon.SignalType(),
    });
    const stateIds = Behavon.createId({ value: Behavon.StateType<number>() });
    const sharedId = Behavon.createId();
    const Model: Model<undefined, number, Port> = () => {
      const [value] = Behavon.useLabelState(stateIds.value, 0);
      const open = Behavon.useCallback((amount: number) => {
        Behavon.transaction.start(sharedId, [stateIds.value]);
        Behavon.transaction.run(sharedId, ({ set }) => set(stateIds.value, amount));
      }, []);
      const finish = Behavon.useCallback(() => Behavon.transaction.commit(sharedId), []);
      Behavon.useSignal(port, "open", open);
      Behavon.useExport(port, "open");
      Behavon.useSignal(port, "finish", finish);
      Behavon.useExport(port, "finish");
      return value;
    };
    const first = Behavon.createModel(Model, undefined);
    const second = Behavon.createModel(Model, undefined);
    first.open(1);
    second.open(2);
    first.finish();
    second.finish();
    expect(outputOf(first as object)).toBe(1);
    expect(outputOf(second as object)).toBe(2);
    first.dispose();
    second.dispose();
  });

  it("rejects cross-owner run and rollback without current-root provenance authority", () => {
    interface OwnerPort {
      open: Signal;
      finish: Signal;
    }
    interface IntruderPort {
      run: Signal;
      rollback: Signal;
      commit: Signal;
    }
    const ownerPort = Behavon.createPort<OwnerPort>({
      open: Behavon.SignalType(),
      finish: Behavon.SignalType(),
    });
    const intruderPort = Behavon.createPort<IntruderPort>({
      run: Behavon.SignalType(),
      rollback: Behavon.SignalType(),
      commit: Behavon.SignalType(),
    });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const sharedId = Behavon.createId();
    const Owner: Model<undefined, number, OwnerPort> = () => {
      const [value] = Behavon.useLabelState(states.value, 0);
      const open = Behavon.useCallback(() => {
        Behavon.transaction.start(sharedId, [states.value]);
        Behavon.transaction.run(sharedId, ({ set }) => set(states.value, 1));
      }, []);
      const finish = Behavon.useCallback(() => Behavon.transaction.commit(sharedId), []);
      Behavon.useSignal(ownerPort, "open", open);
      Behavon.useExport(ownerPort, "open");
      Behavon.useSignal(ownerPort, "finish", finish);
      Behavon.useExport(ownerPort, "finish");
      return value;
    };
    const Intruder: Model<undefined, undefined, IntruderPort> = () => {
      const run = Behavon.useCallback(() => Behavon.transaction.run(sharedId, () => undefined), []);
      const rollback = Behavon.useCallback(() => Behavon.transaction.rollback(sharedId), []);
      const commit = Behavon.useCallback(() => Behavon.transaction.commit(sharedId), []);
      Behavon.useSignal(intruderPort, "run", run);
      Behavon.useExport(intruderPort, "run");
      Behavon.useSignal(intruderPort, "rollback", rollback);
      Behavon.useExport(intruderPort, "rollback");
      Behavon.useSignal(intruderPort, "commit", commit);
      Behavon.useExport(intruderPort, "commit");
      return undefined;
    };
    const owner = Behavon.createModel(Owner, undefined);
    const intruder = Behavon.createModel(Intruder, undefined);
    owner.open();
    expect(() => intruder.run()).toThrow(/started by the current Model instance/);
    expect(() => intruder.rollback()).toThrow(/started by the current Model instance/);
    expect(() => intruder.commit()).toThrow(/current root transaction provenance/);
    owner.finish();
    expect(outputOf(owner as object)).toBe(1);
    intruder.dispose();
    owner.dispose();
  });

  it("prefers current-root upstream commit provenance over an unrelated owned scope with the same raw id", () => {
    interface SourcePort {
      transfer: Signal;
      changed: Signal<[sourceId: TransactionId]>;
    }
    interface TargetPort {
      openOwn: Signal;
      finishOwn: Signal;
      receive: Slot<[sourceId: TransactionId]>;
    }
    const sourcePort = Behavon.createPort<SourcePort>({
      transfer: Behavon.SignalType(),
      changed: Behavon.SignalType(),
    });
    const targetPort = Behavon.createPort<TargetPort>({
      openOwn: Behavon.SignalType(),
      finishOwn: Behavon.SignalType(),
      receive: Behavon.SlotType(),
    });
    const sourceStates = Behavon.createId({ value: Behavon.StateType<number>() });
    const targetStates = Behavon.createId({ value: Behavon.StateType<number>() });
    const sharedId = Behavon.createId();

    const Source: Model<undefined, number, SourcePort> = () => {
      const [value] = Behavon.useLabelState(sourceStates.value, 0);
      const changedBody = Behavon.useCallback((_sourceId: TransactionId) => undefined, []);
      const changed = Behavon.useSignal(sourcePort, "changed", changedBody);
      Behavon.useExport(sourcePort, "changed");
      const transfer = Behavon.useCallback(() => {
        Behavon.transaction.start(sharedId, [sourceStates.value]);
        Behavon.transaction.run(sharedId, ({ set }) => {
          set(sourceStates.value, 1);
          changed(sharedId);
        });
      }, [changed]);
      Behavon.useSignal(sourcePort, "transfer", transfer);
      Behavon.useExport(sourcePort, "transfer");
      return value;
    };
    const Target: Model<undefined, number, TargetPort> = () => {
      const [value] = Behavon.useLabelState(targetStates.value, 0);
      const openOwn = Behavon.useCallback(() => {
        Behavon.transaction.start(sharedId, [targetStates.value]);
        Behavon.transaction.run(sharedId, ({ set }) => set(targetStates.value, 10));
      }, []);
      const finishOwn = Behavon.useCallback(() => Behavon.transaction.commit(sharedId), []);
      const receive = Behavon.useCallback((sourceId: TransactionId) => {
        Behavon.transaction.commit(sourceId);
      }, []);
      Behavon.useSignal(targetPort, "openOwn", openOwn);
      Behavon.useExport(targetPort, "openOwn");
      Behavon.useSignal(targetPort, "finishOwn", finishOwn);
      Behavon.useExport(targetPort, "finishOwn");
      Behavon.useSlot(targetPort, "receive", receive);
      return value;
    };
    const Connection: Model<{
      source: ModelInstance<undefined, number, SourcePort>;
      target: ModelInstance<undefined, number, TargetPort>;
    }, undefined> = (input) => {
      const source = Behavon.usePort(input.source);
      const target = Behavon.usePort(input.target);
      Behavon.useConnect(source.changed, target.receive);
      return undefined;
    };

    const source = Behavon.createModel(Source, undefined);
    const target = Behavon.createModel(Target, undefined);
    const connection = Behavon.createModel(Connection, { source, target });
    target.openOwn();
    source.transfer();
    expect(outputOf(source as object)).toBe(1);
    expect(outputOf(target as object)).toBe(0);
    target.finishOwn();
    expect(outputOf(target as object)).toBe(10);
    connection.dispose();
    target.dispose();
    source.dispose();
  });

  it("rolls back a root owned by a disposed Model even when only a nested Model owns locks", () => {
    interface ChildPort {
      add: Signal;
    }
    interface ParentPort {
      open: Signal;
    }
    const childPort = Behavon.createPort<ChildPort>({ add: Behavon.SignalType() });
    const parentPort = Behavon.createPort<ParentPort>({ open: Behavon.SignalType() });
    const childStates = Behavon.createId({ value: Behavon.StateType<number>() });
    const Child: Model<undefined, number, ChildPort> = () => {
      const [value] = Behavon.useLabelState(childStates.value, 0);
      const add = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [childStates.value]);
        Behavon.transaction.run(id, ({ set }) => set(childStates.value, (previous) => previous + 1));
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(childPort, "add", add);
      Behavon.useExport(childPort, "add");
      return value;
    };
    const Parent: Model<{
      child: ModelInstance<undefined, number, ChildPort>;
    }, undefined, ParentPort> = (input) => {
      const child = input.child;
      const open = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, []);
        Behavon.transaction.run(id, () => child.add());
      }, [child]);
      Behavon.useSignal(parentPort, "open", open);
      Behavon.useExport(parentPort, "open");
      return undefined;
    };

    const child = Behavon.createModel(Child, undefined);
    const parent = Behavon.createModel(Parent, { child });
    parent.open();
    expect(outputOf(child as object)).toBe(0);
    parent.dispose();
    child.add();
    expect(outputOf(child as object)).toBe(1);
    child.dispose();
  });

  it("rolls back a lockless outer root when commit-phase failure disposes its owner", () => {
    const failure = new Error("outer owner effect failed");
    interface ChildPort {
      add: Signal;
    }
    interface ParentPort {
      open: Signal;
      fail: Signal;
    }
    const childPort = Behavon.createPort<ChildPort>({ add: Behavon.SignalType() });
    const parentPort = Behavon.createPort<ParentPort>({
      open: Behavon.SignalType(),
      fail: Behavon.SignalType(),
    });
    const childStates = Behavon.createId({ value: Behavon.StateType<number>() });
    const parentStates = Behavon.createId({ failed: Behavon.StateType<boolean>() });
    const Child: Model<undefined, number, ChildPort> = () => {
      const [value] = Behavon.useLabelState(childStates.value, 0);
      const add = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [childStates.value]);
        Behavon.transaction.run(id, ({ set }) => set(childStates.value, (previous) => previous + 1));
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(childPort, "add", add);
      Behavon.useExport(childPort, "add");
      return value;
    };
    const Parent: Model<{
      child: ModelInstance<undefined, number, ChildPort>;
    }, boolean, ParentPort> = (input) => {
      const child = input.child;
      const [failed] = Behavon.useLabelState(parentStates.failed, false);
      const open = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, []);
        Behavon.transaction.run(id, () => child.add());
      }, [child]);
      const fail = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [parentStates.failed]);
        Behavon.transaction.run(id, ({ set }) => set(parentStates.failed, true));
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(parentPort, "open", open);
      Behavon.useExport(parentPort, "open");
      Behavon.useSignal(parentPort, "fail", fail);
      Behavon.useExport(parentPort, "fail");
      Behavon.useEffect(() => {
        if (failed) throw failure;
      }, [failed]);
      return failed;
    };

    const child = Behavon.createModel(Child, undefined);
    const parent = Behavon.createModel(Parent, { child });
    parent.open();
    expect(() => parent.fail()).toThrow(failure);
    child.add();
    expect(outputOf(child as object)).toBe(1);
    child.dispose();
  });

  it("preserves root-global write order across nested scopes sharing one StateCell", () => {
    interface Port {
      execute: Signal<[rollbackNested: boolean]>;
    }
    const port = Behavon.createPort<Port>({ execute: Behavon.SignalType() });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value] = Behavon.useLabelState(states.value, 0);
      const execute = Behavon.useCallback((rollbackNested: boolean) => {
        const outer = Behavon.createId();
        Behavon.transaction.start(outer, [states.value]);
        Behavon.transaction.run(outer, ({ set }) => {
          set(states.value, (previous) => previous * 10 + 1);
          const nested = Behavon.createId();
          Behavon.transaction.start(nested, [states.value]);
          Behavon.transaction.run(nested, ({ set }) => {
            set(states.value, (previous) => previous * 10 + 2);
          });
          if (rollbackNested) Behavon.transaction.rollback(nested);
          else Behavon.transaction.commit(nested);
          set(states.value, (previous) => previous * 10 + 3);
        });
        Behavon.transaction.commit(outer);
      }, []);
      Behavon.useSignal(port, "execute", execute);
      Behavon.useExport(port, "execute");
      return value;
    };
    const committed = Behavon.createModel(Model, undefined);
    committed.execute(false);
    expect(outputOf(committed as object)).toBe(123);
    committed.dispose();

    const rolledBack = Behavon.createModel(Model, undefined);
    rolledBack.execute(true);
    expect(outputOf(rolledBack as object)).toBe(13);
    rolledBack.dispose();
  });

  it("keeps plain useState writes outside commit and releases them after commit or rollback", async () => {
    interface Port {
      execute: Signal<[commit: boolean]>;
    }
    const port = Behavon.createPort<Port>({ execute: Behavon.SignalType() });
    const states = Behavon.createId({ labeled: Behavon.StateType<number>() });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const Model: Model<undefined, readonly [number, number], Port> = () => {
      const [labeled] = Behavon.useLabelState(states.labeled, 0);
      const [plain, setPlain] = Behavon.useState(0);
      const execute = Behavon.useCallback((commit: boolean) => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.labeled]);
        Behavon.transaction.run(id, ({ set }) => {
          set(states.labeled, 1);
          setPlain(1);
        });
        if (commit) Behavon.transaction.commit(id);
        else Behavon.transaction.rollback(id);
      }, [setPlain]);
      Behavon.useSignal(port, "execute", execute);
      Behavon.useExport(port, "execute");
      return [labeled, plain] as const;
    };

    const committed = Behavon.createModel(Model, undefined);
    committed.execute(true);
    expect(outputOf(committed as object)).toEqual([1, 0]);
    await waitFor(() => outputOf<readonly [number, number]>(committed as object)[1] === 1);
    expect(outputOf(committed as object)).toEqual([1, 1]);
    committed.dispose();

    const rolledBack = Behavon.createModel(Model, undefined);
    rolledBack.execute(false);
    expect(outputOf(rolledBack as object)).toEqual([0, 0]);
    await waitFor(() => outputOf<readonly [number, number]>(rolledBack as object)[1] === 1);
    expect(outputOf(rolledBack as object)).toEqual([0, 1]);
    expect(warn).toHaveBeenCalled();
    rolledBack.dispose();
  });

  it("releases deferred plain writes after commit evaluation failure", async () => {
    const failure = new Error("transaction evaluation failed");
    interface PlainPort {
      set: Signal<[value: number]>;
    }
    interface FailingPort {
      execute: Signal;
    }
    const plainPort = Behavon.createPort<PlainPort>({ set: Behavon.SignalType() });
    const failingPort = Behavon.createPort<FailingPort>({ execute: Behavon.SignalType() });
    const states = Behavon.createId({ fail: Behavon.StateType<boolean>() });
    const Plain: Model<undefined, number, PlainPort> = () => {
      const [value, setValue] = Behavon.useState(0);
      const set = Behavon.useCallback((next: number) => setValue(next), [setValue]);
      Behavon.useSignal(plainPort, "set", set);
      Behavon.useExport(plainPort, "set");
      return value;
    };
    const Failing: Model<{
      plain: ModelInstance<undefined, number, PlainPort>;
    }, boolean, FailingPort> = (input) => {
      const [failed] = Behavon.useLabelState(states.fail, false);
      if (failed) throw failure;
      const plain = input.plain;
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.fail]);
        Behavon.transaction.run(id, ({ set }) => {
          set(states.fail, true);
          plain.set(7);
        });
        Behavon.transaction.commit(id);
      }, [plain]);
      Behavon.useSignal(failingPort, "execute", execute);
      Behavon.useExport(failingPort, "execute");
      return failed;
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const plain = Behavon.createModel(Plain, undefined);
    const failing = Behavon.createModel(Failing, { plain });
    expect(() => failing.execute()).toThrow(failure);
    await waitFor(() => outputOf(plain as object) === 7);
    expect(outputOf(plain as object)).toBe(7);
    plain.dispose();
  });

  it("does not roll back activated labeled state when its commit-phase Effect fails", () => {
    const failure = new Error("transaction effect failed");
    interface Port {
      execute: Signal;
    }
    const port = Behavon.createPort<Port>({ execute: Behavon.SignalType() });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value] = Behavon.useLabelState(states.value, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        Behavon.transaction.run(id, ({ set }) => set(states.value, 1));
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(port, "execute", execute);
      Behavon.useExport(port, "execute");
      Behavon.useEffect(() => {
        if (value === 1) throw failure;
      }, [value]);
      return value;
    };

    const instance = Behavon.createModel(Model, undefined);
    const cell = inspectModelInstanceForTests(instance as object).hooks.find(
      (hook) => (hook as { kind?: string }).kind === "state",
    ) as MutableStateSubject;
    expect(() => instance.execute()).toThrow(failure);
    expect(cell.value).toBe(1);
    expect(inspectMutableStateForTests(cell).status).toBe("released");
  });
});

describe("transaction run get and set", () => {
  class InsufficientFunds extends Error {}

  it("lets get see earlier set calls in the same run and refuses the second withdrawal", () => {
    interface Port {
      withdrawTwice: Signal<[first: number, second: number]>;
    }
    const port = Behavon.createPort<Port>({ withdrawTwice: Behavon.SignalType() });
    const states = Behavon.createId({ balance: Behavon.StateType<number>() });
    const seen: number[] = [];
    const Account: Model<undefined, number, Port> = () => {
      const [balance] = Behavon.useLabelState(states.balance, 100);
      const withdrawTwice = Behavon.useCallback((first: number, second: number) => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.balance]);
        Behavon.transaction.run(id, ({ get, set }) => {
          for (const amount of [first, second]) {
            seen.push(get(states.balance));
            if (get(states.balance) < amount) throw new InsufficientFunds();
            set(states.balance, get(states.balance) - amount);
          }
        });
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(port, "withdrawTwice", withdrawTwice);
      Behavon.useExport(port, "withdrawTwice");
      return balance;
    };
    const account = Behavon.createModel(Account, undefined);

    expect(() => account.withdrawTwice(80, 30)).toThrow(InsufficientFunds);
    expect(seen).toEqual([100, 20]);
    expect(outputOf(account as object)).toBe(100);

    account.withdrawTwice(60, 30);
    expect(outputOf(account as object)).toBe(10);
    account.dispose();
  });

  it("runs a set function at once and rolls back without ending the Model when it throws", () => {
    interface Port {
      update: Signal<[fail: boolean]>;
    }
    const port = Behavon.createPort<Port>({ update: Behavon.SignalType() });
    const states = Behavon.createId({ value: Behavon.StateType<number>() });
    const calls: string[] = [];
    const Counter: Model<undefined, number, Port> = () => {
      const [value] = Behavon.useLabelState(states.value, 1);
      const update = Behavon.useCallback((fail: boolean) => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        Behavon.transaction.run(id, ({ set }) => {
          set(states.value, (last) => {
            calls.push(`updater:${last}`);
            if (fail) throw new Error("refused");
            return last + 1;
          });
          calls.push("after set");
        });
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(port, "update", update);
      Behavon.useExport(port, "update");
      return value;
    };
    const counter = Behavon.createModel(Counter, undefined);

    expect(() => counter.update(true)).toThrow("refused");
    expect(calls).toEqual(["updater:1"]);
    expect(outputOf(counter as object)).toBe(1);

    calls.length = 0;
    counter.update(false);
    expect(calls).toEqual(["updater:1", "after set"]);
    expect(outputOf(counter as object)).toBe(2);
    counter.dispose();
  });

  it("keeps a function returned by a set updater as the stored value", () => {
    interface Port {
      replace: Signal;
    }
    const port = Behavon.createPort<Port>({ replace: Behavon.SignalType() });
    const states = Behavon.createId({ format: Behavon.StateType<(value: number) => string>() });
    const initial = (value: number) => `initial ${value}`;
    const replacement = (value: number) => `replacement ${value}`;
    const Formatter: Model<undefined, (value: number) => string, Port> = () => {
      const [format] = Behavon.useLabelState(states.format, () => initial);
      const replace = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.format]);
        Behavon.transaction.run(id, ({ set }) => set(states.format, () => replacement));
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(port, "replace", replace);
      Behavon.useExport(port, "replace");
      return format;
    };
    const formatter = Behavon.createModel(Formatter, undefined);
    formatter.replace();
    expect(outputOf(formatter as object)).toBe(replacement);
    formatter.dispose();
  });

  it("rejects get and set for a state outside the lock list, a locked setter inside run, and access after run", () => {
    interface Port {
      probe: Signal<[mode: "get" | "set" | "setter" | "unlockedSetter" | "late"]>;
    }
    const port = Behavon.createPort<Port>({ probe: Behavon.SignalType() });
    const states = Behavon.createId({
      locked: Behavon.StateType<number>(),
      other: Behavon.StateType<number>(),
    });
    let retained: TransactionAccess | undefined;
    const Probe: Model<undefined, readonly [number, number], Port> = () => {
      const [locked, setLocked] = Behavon.useLabelState(states.locked, 0);
      const [other, setOther] = Behavon.useLabelState(states.other, 0);
      const probe = Behavon.useCallback((mode: "get" | "set" | "setter" | "unlockedSetter" | "late") => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.locked]);
        try {
          Behavon.transaction.run(id, (access) => {
            retained = access;
            if (mode === "get") access.get(states.other);
            if (mode === "set") access.set(states.other, 1);
            if (mode === "setter") setLocked(1);
            if (mode === "unlockedSetter") setOther(1);
          });
          if (mode === "late") retained?.get(states.locked);
          Behavon.transaction.commit(id);
        } catch (error) {
          if (mode === "late") Behavon.transaction.rollback(id);
          throw error;
        }
      }, [setLocked, setOther]);
      Behavon.useSignal(port, "probe", probe);
      Behavon.useExport(port, "probe");
      return [locked, other] as const;
    };
    const probe = Behavon.createModel(Probe, undefined);

    expect(() => probe.probe("get")).toThrow("Behavon transaction get requires a StateId locked by this transaction.start");
    expect(() => probe.probe("set")).toThrow("Behavon transaction set requires a StateId locked by this transaction.start");
    expect(() => probe.probe("setter")).toThrow(
      "Behavon.useLabelState setter cannot change a locked state inside transaction.run; use set from the run body",
    );
    expect(() => probe.probe("unlockedSetter")).toThrow(
      "Behavon.useLabelState setter requires its StateId in the active transaction.start lock list",
    );
    expect(() => probe.probe("late")).toThrow("Behavon transaction get can be used only while its run body executes");
    expect(outputOf(probe as object)).toEqual([0, 0]);
    probe.dispose();
  });

  it("lets a joined Model see its own earlier change in the same root and rolls the whole root back", () => {
    interface AccountPort {
      withdraw: Signal<[amount: number]>;
    }
    const accountPort = Behavon.createPort<AccountPort>({ withdraw: Behavon.SignalType() });
    const accountStates = Behavon.createId({ balance: Behavon.StateType<number>() });
    const Account: Model<undefined, number, AccountPort> = () => {
      const [balance] = Behavon.useLabelState(accountStates.balance, 100);
      const withdraw = Behavon.useCallback((amount: number) => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [accountStates.balance]);
        Behavon.transaction.run(id, ({ get, set }) => {
          if (get(accountStates.balance) < amount) throw new InsufficientFunds();
          set(accountStates.balance, get(accountStates.balance) - amount);
        });
        Behavon.transaction.commit(id);
      }, []);
      Behavon.useSignal(accountPort, "withdraw", withdraw);
      Behavon.useExport(accountPort, "withdraw");
      return balance;
    };

    interface BankPort {
      pay: Signal<[amount: number, fee: number]>;
    }
    const bankPort = Behavon.createPort<BankPort>({ pay: Behavon.SignalType() });
    const bankStates = Behavon.createId({ payments: Behavon.StateType<number>() });
    const Bank: Model<ModelInstance<undefined, number, AccountPort>, number, BankPort> = (account) => {
      const [payments] = Behavon.useLabelState(bankStates.payments, 0);
      const pay = Behavon.useCallback((amount: number, fee: number) => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [bankStates.payments]);
        Behavon.transaction.run(id, ({ set }) => {
          set(bankStates.payments, (count) => count + 1);
          account.withdraw(amount);
          account.withdraw(fee);
        });
        Behavon.transaction.commit(id);
      }, [account]);
      Behavon.useSignal(bankPort, "pay", pay);
      Behavon.useExport(bankPort, "pay");
      return payments;
    };

    const account = Behavon.createModel(Account, undefined);
    const bank = Behavon.createModel(Bank, account);

    expect(() => bank.pay(80, 30)).toThrow(InsufficientFunds);
    expect(outputOf(account as object)).toBe(100);
    expect(outputOf(bank as object)).toBe(0);

    bank.pay(60, 30);
    expect(outputOf(account as object)).toBe(10);
    expect(outputOf(bank as object)).toBe(1);
    bank.dispose();
    account.dispose();
  });
});
