import { describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import type { Model, ModelInstance, Signal, Slot, TransactionId } from "behavon";
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
      const [first, setFirst] = Behavon.useLabelState(states.first, 0);
      const [second, setSecond] = Behavon.useLabelState(states.second, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.first, states.second]);
        Behavon.transaction.run(id, () => {
          setFirst(1);
          setSecond(2);
          observations.push(outputOf<readonly [number, number]>(instance as object));
        });
        Behavon.transaction.commit(id);
      }, [setFirst, setSecond]);
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
      const [value, setValue] = Behavon.useLabelState(states.value, 0);
      const fail = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        Behavon.transaction.run(id, () => {
          setValue(1);
          throw failure;
        });
      }, [setValue]);
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
      const [value, setValue] = Behavon.useLabelState(states.value, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        const asyncBody = (async () => {
          setValue(1);
        }) as unknown as () => void;
        Behavon.transaction.run(id, asyncBody);
      }, [setValue]);
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
      const [second, setSecond] = Behavon.useLabelState(states.second, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.first]);
        Behavon.transaction.run(id, () => setSecond(1));
      }, [setSecond]);
      Behavon.useSignal(port, "execute", execute);
      Behavon.useExport(port, "execute");
      return [first, second] as const;
    };
    const instance = Behavon.createModel(Model, undefined);
    expect(() => instance.execute()).toThrow(/active transaction\.start lock list/);
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
      const [value, setValue] = Behavon.useLabelState(states.value, 0);
      const open = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        Behavon.transaction.run(id, () => setValue(1));
      }, [setValue]);
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
      const [value, setValue] = Behavon.useLabelState(childStates.value, 0);
      const add = Behavon.useCallback((amount: number) => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [childStates.value]);
        Behavon.transaction.run(id, () => setValue((previous) => previous + amount));
        Behavon.transaction.commit(id);
      }, [setValue]);
      Behavon.useSignal(childPort, "add", add);
      Behavon.useExport(childPort, "add");
      return value;
    };
    const Parent: Model<{
      child: ModelInstance<undefined, number, ChildPort>;
    }, number, ParentPort> = (input) => {
      const child = input.child;
      const [childValue] = Behavon.useModel(child);
      const [value, setValue] = Behavon.useLabelState(parentStates.value, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [parentStates.value]);
        Behavon.transaction.run(id, () => {
          setValue(1);
          child.add(2);
        });
        Behavon.transaction.commit(id);
      }, [child, setValue]);
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
      const [value, setValue] = Behavon.useLabelState(stateIds.value, 0);
      const open = Behavon.useCallback((amount: number) => {
        Behavon.transaction.start(sharedId, [stateIds.value]);
        Behavon.transaction.run(sharedId, () => setValue(amount));
      }, [setValue]);
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
      const [value, setValue] = Behavon.useLabelState(states.value, 0);
      const open = Behavon.useCallback(() => {
        Behavon.transaction.start(sharedId, [states.value]);
        Behavon.transaction.run(sharedId, () => setValue(1));
      }, [setValue]);
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
      const [value, setValue] = Behavon.useLabelState(sourceStates.value, 0);
      const changedBody = Behavon.useCallback((_sourceId: TransactionId) => undefined, []);
      const changed = Behavon.useSignal(sourcePort, "changed", changedBody);
      Behavon.useExport(sourcePort, "changed");
      const transfer = Behavon.useCallback(() => {
        Behavon.transaction.start(sharedId, [sourceStates.value]);
        Behavon.transaction.run(sharedId, () => {
          setValue(1);
          changed(sharedId);
        });
      }, [changed, setValue]);
      Behavon.useSignal(sourcePort, "transfer", transfer);
      Behavon.useExport(sourcePort, "transfer");
      return value;
    };
    const Target: Model<undefined, number, TargetPort> = () => {
      const [value, setValue] = Behavon.useLabelState(targetStates.value, 0);
      const openOwn = Behavon.useCallback(() => {
        Behavon.transaction.start(sharedId, [targetStates.value]);
        Behavon.transaction.run(sharedId, () => setValue(10));
      }, [setValue]);
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
      const [value, setValue] = Behavon.useLabelState(childStates.value, 0);
      const add = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [childStates.value]);
        Behavon.transaction.run(id, () => setValue((previous) => previous + 1));
        Behavon.transaction.commit(id);
      }, [setValue]);
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
      const [value, setValue] = Behavon.useLabelState(childStates.value, 0);
      const add = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [childStates.value]);
        Behavon.transaction.run(id, () => setValue((previous) => previous + 1));
        Behavon.transaction.commit(id);
      }, [setValue]);
      Behavon.useSignal(childPort, "add", add);
      Behavon.useExport(childPort, "add");
      return value;
    };
    const Parent: Model<{
      child: ModelInstance<undefined, number, ChildPort>;
    }, boolean, ParentPort> = (input) => {
      const child = input.child;
      const [failed, setFailed] = Behavon.useLabelState(parentStates.failed, false);
      const open = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, []);
        Behavon.transaction.run(id, () => child.add());
      }, [child]);
      const fail = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [parentStates.failed]);
        Behavon.transaction.run(id, () => setFailed(true));
        Behavon.transaction.commit(id);
      }, [setFailed]);
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
      const [value, setValue] = Behavon.useLabelState(states.value, 0);
      const execute = Behavon.useCallback((rollbackNested: boolean) => {
        const outer = Behavon.createId();
        Behavon.transaction.start(outer, [states.value]);
        Behavon.transaction.run(outer, () => {
          setValue((previous) => previous * 10 + 1);
          const nested = Behavon.createId();
          Behavon.transaction.start(nested, [states.value]);
          Behavon.transaction.run(nested, () => {
            setValue((previous) => previous * 10 + 2);
          });
          if (rollbackNested) Behavon.transaction.rollback(nested);
          else Behavon.transaction.commit(nested);
          setValue((previous) => previous * 10 + 3);
        });
        Behavon.transaction.commit(outer);
      }, [setValue]);
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
      const [labeled, setLabeled] = Behavon.useLabelState(states.labeled, 0);
      const [plain, setPlain] = Behavon.useState(0);
      const execute = Behavon.useCallback((commit: boolean) => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.labeled]);
        Behavon.transaction.run(id, () => {
          setLabeled(1);
          setPlain(1);
        });
        if (commit) Behavon.transaction.commit(id);
        else Behavon.transaction.rollback(id);
      }, [setLabeled, setPlain]);
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
      const [failed, setFailed] = Behavon.useLabelState(states.fail, false);
      if (failed) throw failure;
      const plain = input.plain;
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.fail]);
        Behavon.transaction.run(id, () => {
          setFailed(true);
          plain.set(7);
        });
        Behavon.transaction.commit(id);
      }, [plain, setFailed]);
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
      const [value, setValue] = Behavon.useLabelState(states.value, 0);
      const execute = Behavon.useCallback(() => {
        const id = Behavon.createId();
        Behavon.transaction.start(id, [states.value]);
        Behavon.transaction.run(id, () => setValue(1));
        Behavon.transaction.commit(id);
      }, [setValue]);
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
