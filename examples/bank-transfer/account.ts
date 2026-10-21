import Behavon, { type Model, type Signal, type SnapshotRootId } from "behavon";

export class InsufficientFundsError extends Error {
  constructor(readonly account: string, readonly balance: number, readonly amount: number) {
    super(`${account} 잔액 부족: 잔액 ${balance}원, 출금 ${amount}원`);
    this.name = "InsufficientFundsError";
  }
}

export interface AccountView {
  readonly name: string;
  readonly balance: number;
}

export interface AccountPort {
  view: SnapshotRootId<AccountView>;
  deposit: Signal<[amount: number]>;
  withdraw: Signal<[amount: number]>;
}

const accountPort = Behavon.createPort<AccountPort>({
  view: Behavon.SnapshotType(),
  deposit: Behavon.SignalType(),
  withdraw: Behavon.SignalType(),
});

/** What the screen uses. */
export type AccountScreenPort = Pick<AccountPort, "view">;

const states = Behavon.createId({ balance: Behavon.StateType<number>() });

export interface AccountInput {
  readonly name: string;
  readonly balance: number;
}

/**
 * One account. Each deposit and withdrawal is its own transaction, so it also works on its own.
 * Called inside another transaction's `run`, it becomes part of that transaction.
 */
export const Account: Model<AccountInput, number, AccountPort> = (input) => {
  const { name } = input;
  const viewId = Behavon.useExport(accountPort, "view");
  const [balance, setBalance] = Behavon.useLabelState(states.balance, input.balance);

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => publish({ name, balance }), [balance, name, publish]);

  const deposit = Behavon.useCallback((amount: number) => {
    const id = Behavon.createId();
    Behavon.transaction.start(id, [states.balance]);
    Behavon.transaction.run(id, () => setBalance((current) => current + amount));
    Behavon.transaction.commit(id);
  }, [setBalance]);
  Behavon.useSignal(accountPort, "deposit", deposit);
  Behavon.useExport(accountPort, "deposit");

  // `balance` is the last committed balance. A change made earlier in the same transaction is not visible here.
  const withdraw = Behavon.useCallback((amount: number) => {
    const id = Behavon.createId();
    Behavon.transaction.start(id, [states.balance]);
    Behavon.transaction.run(id, () => {
      if (balance < amount) throw new InsufficientFundsError(name, balance, amount);
      setBalance((current) => current - amount);
    });
    Behavon.transaction.commit(id);
  }, [balance, name, setBalance]);
  Behavon.useSignal(accountPort, "withdraw", withdraw);
  Behavon.useExport(accountPort, "withdraw");

  return balance;
};
