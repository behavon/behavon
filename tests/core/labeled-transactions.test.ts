import { describe, expect, it, vi } from "vitest";
import Behave from "behavon";
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
    const port = Behave.createPort<Port>({ execute: Behave.SignalType() });
    const states = Behave.createId({
      first: Behave.StateType<number>(),
      second: Behave.StateType<number>(),
    });
    const observations: Array<readonly [number, number]> = [];

    const Model: Model<undefined, readonly [number, number], Port> = () => {
      const [first, setFirst] = Behave.useLabelState(states.first, 0);
      const [second, setSecond] = Behave.useLabelState(states.second, 0);
      const execute = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [states.first, states.second]);
        Behave.transaction.run(id, () => {
          setFirst(1);
          setSecond(2);
          observations.push(outputOf<readonly [number, number]>(instance as object));
        });
        Behave.transaction.commit(id);
      }, [setFirst, setSecond]);
      Behave.useSignal(port, "execute", execute);
      return [first, second] as const;
    };

    const instance = Behave.createModel(Model, undefined);
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
    const port = Behave.createPort<Port>({ fail: Behave.SignalType() });
    const states = Behave.createId({ value: Behave.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value, setValue] = Behave.useLabelState(states.value, 0);
      const fail = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [states.value]);
        Behave.transaction.run(id, () => {
          setValue(1);
          throw failure;
        });
      }, [setValue]);
      Behave.useSignal(port, "fail", fail);
      return value;
    };
    const instance = Behave.createModel(Model, undefined);
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
    const port = Behave.createPort<Port>({
      open: Behave.SignalType(),
      conflict: Behave.SignalType(),
      cancel: Behave.SignalType(),
    });
    const states = Behave.createId({ value: Behave.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value] = Behave.useLabelState(states.value, 0);
      const active = Behave.useMutable<TransactionId | undefined>(undefined);
      const open = Behave.useCallback(() => {
        const id = Behave.createId();
        active.set(id);
        Behave.transaction.start(id, [states.value]);
      }, []);
      const conflict = Behave.useCallback(() => {
        const other = Behave.createId();
        Behave.transaction.start(other, [states.value]);
      }, []);
      const cancel = Behave.useCallback(() => {
        const id = active.get();
        if (id !== undefined) Behave.transaction.rollback(id);
      }, []);
      Behave.useSignal(port, "open", open);
      Behave.useSignal(port, "conflict", conflict);
      Behave.useSignal(port, "cancel", cancel);
      return value;
    };
    const instance = Behave.createModel(Model, undefined);
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
    const port = Behave.createPort<Port>({
      open: Behave.SignalType(),
      externalSet: Behave.SignalType(),
      cancel: Behave.SignalType(),
    });
    const states = Behave.createId({ value: Behave.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value, setValue] = Behave.useLabelState(states.value, 0);
      const active = Behave.useMutable<TransactionId | undefined>(undefined);
      const open = Behave.useCallback(() => {
        const id = Behave.createId();
        active.set(id);
        Behave.transaction.start(id, [states.value]);
      }, []);
      const externalSet = Behave.useCallback((next: number) => setValue(next), [setValue]);
      const cancel = Behave.useCallback(() => {
        const id = active.get();
        if (id !== undefined) Behave.transaction.rollback(id);
      }, []);
      Behave.useSignal(port, "open", open);
      Behave.useSignal(port, "externalSet", externalSet);
      Behave.useSignal(port, "cancel", cancel);
      return value;
    };
    const instance = Behave.createModel(Model, undefined);
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
    const port = Behave.createPort<Port>({ execute: Behave.SignalType() });
    const states = Behave.createId({ value: Behave.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value, setValue] = Behave.useLabelState(states.value, 0);
      const execute = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [states.value]);
        const asyncBody = (async () => {
          setValue(1);
        }) as unknown as () => void;
        Behave.transaction.run(id, asyncBody);
      }, [setValue]);
      Behave.useSignal(port, "execute", execute);
      return value;
    };
    const instance = Behave.createModel(Model, undefined);
    expect(() => instance.execute()).toThrow(/requires a synchronous body/);
    expect(outputOf(instance as object)).toBe(0);
    instance.dispose();
  });

  it("fails fast when a labeled setter was omitted from the active lock list", () => {
    interface Port {
      execute: Signal;
    }
    const port = Behave.createPort<Port>({ execute: Behave.SignalType() });
    const states = Behave.createId({
      first: Behave.StateType<number>(),
      second: Behave.StateType<number>(),
    });
    const Model: Model<undefined, readonly [number, number], Port> = () => {
      const [first] = Behave.useLabelState(states.first, 0);
      const [second, setSecond] = Behave.useLabelState(states.second, 0);
      const execute = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [states.first]);
        Behave.transaction.run(id, () => setSecond(1));
      }, [setSecond]);
      Behave.useSignal(port, "execute", execute);
      return [first, second] as const;
    };
    const instance = Behave.createModel(Model, undefined);
    expect(() => instance.execute()).toThrow(/active transaction\.start lock list/);
    expect(outputOf(instance as object)).toEqual([0, 0]);
    instance.dispose();
  });

  it("rolls back and unlocks an open root when its owner is disposed", () => {
    interface Port {
      open: Signal;
    }
    const port = Behave.createPort<Port>({ open: Behave.SignalType() });
    const states = Behave.createId({ value: Behave.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value, setValue] = Behave.useLabelState(states.value, 0);
      const open = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [states.value]);
        Behave.transaction.run(id, () => setValue(1));
      }, [setValue]);
      Behave.useSignal(port, "open", open);
      return value;
    };
    const instance = Behave.createModel(Model, undefined);
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
    const childPort = Behave.createPort<ChildPort>({ add: Behave.SignalType() });
    const parentPort = Behave.createPort<ParentPort>({ execute: Behave.SignalType() });
    const childStates = Behave.createId({ value: Behave.StateType<number>() });
    const parentStates = Behave.createId({ value: Behave.StateType<number>() });
    const Child: Model<undefined, number, ChildPort> = () => {
      const [value, setValue] = Behave.useLabelState(childStates.value, 0);
      const add = Behave.useCallback((amount: number) => {
        const id = Behave.createId();
        Behave.transaction.start(id, [childStates.value]);
        Behave.transaction.run(id, () => setValue((previous) => previous + amount));
        Behave.transaction.commit(id);
      }, [setValue]);
      Behave.useSignal(childPort, "add", add);
      return value;
    };
    const Parent: Model<{
      child: ModelInstance<undefined, number, ChildPort>;
    }, number, ParentPort> = (input) => {
      const child = input.child;
      const [childValue] = Behave.useModel(child);
      const [value, setValue] = Behave.useLabelState(parentStates.value, 0);
      const execute = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [parentStates.value]);
        Behave.transaction.run(id, () => {
          setValue(1);
          child.add(2);
        });
        Behave.transaction.commit(id);
      }, [child, setValue]);
      Behave.useSignal(parentPort, "execute", execute);
      return value + childValue;
    };
    const child = Behave.createModel(Child, undefined);
    const parent = Behave.createModel(Parent, { child });
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
    const port = Behave.createPort<Port>({
      open: Behave.SignalType(),
      finish: Behave.SignalType(),
    });
    const stateIds = Behave.createId({ value: Behave.StateType<number>() });
    const sharedId = Behave.createId();
    const Model: Model<undefined, number, Port> = () => {
      const [value, setValue] = Behave.useLabelState(stateIds.value, 0);
      const open = Behave.useCallback((amount: number) => {
        Behave.transaction.start(sharedId, [stateIds.value]);
        Behave.transaction.run(sharedId, () => setValue(amount));
      }, [setValue]);
      const finish = Behave.useCallback(() => Behave.transaction.commit(sharedId), []);
      Behave.useSignal(port, "open", open);
      Behave.useSignal(port, "finish", finish);
      return value;
    };
    const first = Behave.createModel(Model, undefined);
    const second = Behave.createModel(Model, undefined);
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
    const ownerPort = Behave.createPort<OwnerPort>({
      open: Behave.SignalType(),
      finish: Behave.SignalType(),
    });
    const intruderPort = Behave.createPort<IntruderPort>({
      run: Behave.SignalType(),
      rollback: Behave.SignalType(),
      commit: Behave.SignalType(),
    });
    const states = Behave.createId({ value: Behave.StateType<number>() });
    const sharedId = Behave.createId();
    const Owner: Model<undefined, number, OwnerPort> = () => {
      const [value, setValue] = Behave.useLabelState(states.value, 0);
      const open = Behave.useCallback(() => {
        Behave.transaction.start(sharedId, [states.value]);
        Behave.transaction.run(sharedId, () => setValue(1));
      }, [setValue]);
      const finish = Behave.useCallback(() => Behave.transaction.commit(sharedId), []);
      Behave.useSignal(ownerPort, "open", open);
      Behave.useSignal(ownerPort, "finish", finish);
      return value;
    };
    const Intruder: Model<undefined, undefined, IntruderPort> = () => {
      const run = Behave.useCallback(() => Behave.transaction.run(sharedId, () => undefined), []);
      const rollback = Behave.useCallback(() => Behave.transaction.rollback(sharedId), []);
      const commit = Behave.useCallback(() => Behave.transaction.commit(sharedId), []);
      Behave.useSignal(intruderPort, "run", run);
      Behave.useSignal(intruderPort, "rollback", rollback);
      Behave.useSignal(intruderPort, "commit", commit);
      return undefined;
    };
    const owner = Behave.createModel(Owner, undefined);
    const intruder = Behave.createModel(Intruder, undefined);
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
    const sourcePort = Behave.createPort<SourcePort>({
      transfer: Behave.SignalType(),
      changed: Behave.SignalType(),
    });
    const targetPort = Behave.createPort<TargetPort>({
      openOwn: Behave.SignalType(),
      finishOwn: Behave.SignalType(),
      receive: Behave.SlotType(),
    });
    const sourceStates = Behave.createId({ value: Behave.StateType<number>() });
    const targetStates = Behave.createId({ value: Behave.StateType<number>() });
    const sharedId = Behave.createId();

    const Source: Model<undefined, number, SourcePort> = () => {
      const [value, setValue] = Behave.useLabelState(sourceStates.value, 0);
      const changedBody = Behave.useCallback((_sourceId: TransactionId) => undefined, []);
      const changed = Behave.useSignal(sourcePort, "changed", changedBody);
      const transfer = Behave.useCallback(() => {
        Behave.transaction.start(sharedId, [sourceStates.value]);
        Behave.transaction.run(sharedId, () => {
          setValue(1);
          changed(sharedId);
        });
      }, [changed, setValue]);
      Behave.useSignal(sourcePort, "transfer", transfer);
      return value;
    };
    const Target: Model<undefined, number, TargetPort> = () => {
      const [value, setValue] = Behave.useLabelState(targetStates.value, 0);
      const openOwn = Behave.useCallback(() => {
        Behave.transaction.start(sharedId, [targetStates.value]);
        Behave.transaction.run(sharedId, () => setValue(10));
      }, [setValue]);
      const finishOwn = Behave.useCallback(() => Behave.transaction.commit(sharedId), []);
      const receive = Behave.useCallback((sourceId: TransactionId) => {
        Behave.transaction.commit(sourceId);
      }, []);
      Behave.useSignal(targetPort, "openOwn", openOwn);
      Behave.useSignal(targetPort, "finishOwn", finishOwn);
      Behave.useSlot(targetPort, "receive", receive);
      return value;
    };
    const Connection: Model<{
      source: ModelInstance<undefined, number, SourcePort>;
      target: ModelInstance<undefined, number, TargetPort>;
    }, undefined> = (input) => {
      const source = Behave.usePort(input.source);
      const target = Behave.usePort(input.target);
      Behave.useConnect(source.changed, target.receive);
      return undefined;
    };

    const source = Behave.createModel(Source, undefined);
    const target = Behave.createModel(Target, undefined);
    const connection = Behave.createModel(Connection, { source, target });
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
    const childPort = Behave.createPort<ChildPort>({ add: Behave.SignalType() });
    const parentPort = Behave.createPort<ParentPort>({ open: Behave.SignalType() });
    const childStates = Behave.createId({ value: Behave.StateType<number>() });
    const Child: Model<undefined, number, ChildPort> = () => {
      const [value, setValue] = Behave.useLabelState(childStates.value, 0);
      const add = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [childStates.value]);
        Behave.transaction.run(id, () => setValue((previous) => previous + 1));
        Behave.transaction.commit(id);
      }, [setValue]);
      Behave.useSignal(childPort, "add", add);
      return value;
    };
    const Parent: Model<{
      child: ModelInstance<undefined, number, ChildPort>;
    }, undefined, ParentPort> = (input) => {
      const child = input.child;
      const open = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, []);
        Behave.transaction.run(id, () => child.add());
      }, [child]);
      Behave.useSignal(parentPort, "open", open);
      return undefined;
    };

    const child = Behave.createModel(Child, undefined);
    const parent = Behave.createModel(Parent, { child });
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
    const childPort = Behave.createPort<ChildPort>({ add: Behave.SignalType() });
    const parentPort = Behave.createPort<ParentPort>({
      open: Behave.SignalType(),
      fail: Behave.SignalType(),
    });
    const childStates = Behave.createId({ value: Behave.StateType<number>() });
    const parentStates = Behave.createId({ failed: Behave.StateType<boolean>() });
    const Child: Model<undefined, number, ChildPort> = () => {
      const [value, setValue] = Behave.useLabelState(childStates.value, 0);
      const add = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [childStates.value]);
        Behave.transaction.run(id, () => setValue((previous) => previous + 1));
        Behave.transaction.commit(id);
      }, [setValue]);
      Behave.useSignal(childPort, "add", add);
      return value;
    };
    const Parent: Model<{
      child: ModelInstance<undefined, number, ChildPort>;
    }, boolean, ParentPort> = (input) => {
      const child = input.child;
      const [failed, setFailed] = Behave.useLabelState(parentStates.failed, false);
      const open = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, []);
        Behave.transaction.run(id, () => child.add());
      }, [child]);
      const fail = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [parentStates.failed]);
        Behave.transaction.run(id, () => setFailed(true));
        Behave.transaction.commit(id);
      }, [setFailed]);
      Behave.useSignal(parentPort, "open", open);
      Behave.useSignal(parentPort, "fail", fail);
      Behave.useEffect(() => {
        if (failed) throw failure;
      }, [failed]);
      return failed;
    };

    const child = Behave.createModel(Child, undefined);
    const parent = Behave.createModel(Parent, { child });
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
    const port = Behave.createPort<Port>({ execute: Behave.SignalType() });
    const states = Behave.createId({ value: Behave.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value, setValue] = Behave.useLabelState(states.value, 0);
      const execute = Behave.useCallback((rollbackNested: boolean) => {
        const outer = Behave.createId();
        Behave.transaction.start(outer, [states.value]);
        Behave.transaction.run(outer, () => {
          setValue((previous) => previous * 10 + 1);
          const nested = Behave.createId();
          Behave.transaction.start(nested, [states.value]);
          Behave.transaction.run(nested, () => {
            setValue((previous) => previous * 10 + 2);
          });
          if (rollbackNested) Behave.transaction.rollback(nested);
          else Behave.transaction.commit(nested);
          setValue((previous) => previous * 10 + 3);
        });
        Behave.transaction.commit(outer);
      }, [setValue]);
      Behave.useSignal(port, "execute", execute);
      return value;
    };
    const committed = Behave.createModel(Model, undefined);
    committed.execute(false);
    expect(outputOf(committed as object)).toBe(123);
    committed.dispose();

    const rolledBack = Behave.createModel(Model, undefined);
    rolledBack.execute(true);
    expect(outputOf(rolledBack as object)).toBe(13);
    rolledBack.dispose();
  });

  it("keeps plain useState writes outside commit and releases them after commit or rollback", async () => {
    interface Port {
      execute: Signal<[commit: boolean]>;
    }
    const port = Behave.createPort<Port>({ execute: Behave.SignalType() });
    const states = Behave.createId({ labeled: Behave.StateType<number>() });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const Model: Model<undefined, readonly [number, number], Port> = () => {
      const [labeled, setLabeled] = Behave.useLabelState(states.labeled, 0);
      const [plain, setPlain] = Behave.useState(0);
      const execute = Behave.useCallback((commit: boolean) => {
        const id = Behave.createId();
        Behave.transaction.start(id, [states.labeled]);
        Behave.transaction.run(id, () => {
          setLabeled(1);
          setPlain(1);
        });
        if (commit) Behave.transaction.commit(id);
        else Behave.transaction.rollback(id);
      }, [setLabeled, setPlain]);
      Behave.useSignal(port, "execute", execute);
      return [labeled, plain] as const;
    };

    const committed = Behave.createModel(Model, undefined);
    committed.execute(true);
    expect(outputOf(committed as object)).toEqual([1, 0]);
    await waitFor(() => outputOf<readonly [number, number]>(committed as object)[1] === 1);
    expect(outputOf(committed as object)).toEqual([1, 1]);
    committed.dispose();

    const rolledBack = Behave.createModel(Model, undefined);
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
    const plainPort = Behave.createPort<PlainPort>({ set: Behave.SignalType() });
    const failingPort = Behave.createPort<FailingPort>({ execute: Behave.SignalType() });
    const states = Behave.createId({ fail: Behave.StateType<boolean>() });
    const Plain: Model<undefined, number, PlainPort> = () => {
      const [value, setValue] = Behave.useState(0);
      const set = Behave.useCallback((next: number) => setValue(next), [setValue]);
      Behave.useSignal(plainPort, "set", set);
      return value;
    };
    const Failing: Model<{
      plain: ModelInstance<undefined, number, PlainPort>;
    }, boolean, FailingPort> = (input) => {
      const [failed, setFailed] = Behave.useLabelState(states.fail, false);
      if (failed) throw failure;
      const plain = input.plain;
      const execute = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [states.fail]);
        Behave.transaction.run(id, () => {
          setFailed(true);
          plain.set(7);
        });
        Behave.transaction.commit(id);
      }, [plain, setFailed]);
      Behave.useSignal(failingPort, "execute", execute);
      return failed;
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const plain = Behave.createModel(Plain, undefined);
    const failing = Behave.createModel(Failing, { plain });
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
    const port = Behave.createPort<Port>({ execute: Behave.SignalType() });
    const states = Behave.createId({ value: Behave.StateType<number>() });
    const Model: Model<undefined, number, Port> = () => {
      const [value, setValue] = Behave.useLabelState(states.value, 0);
      const execute = Behave.useCallback(() => {
        const id = Behave.createId();
        Behave.transaction.start(id, [states.value]);
        Behave.transaction.run(id, () => setValue(1));
        Behave.transaction.commit(id);
      }, [setValue]);
      Behave.useSignal(port, "execute", execute);
      Behave.useEffect(() => {
        if (value === 1) throw failure;
      }, [value]);
      return value;
    };

    const instance = Behave.createModel(Model, undefined);
    const cell = inspectModelInstanceForTests(instance as object).hooks.find(
      (hook) => (hook as { kind?: string }).kind === "state",
    ) as MutableStateSubject;
    expect(() => instance.execute()).toThrow(failure);
    expect(cell.value).toBe(1);
    expect(inspectMutableStateForTests(cell).status).toBe("released");
  });
});
