import Behavon, { type Model, type Signal, type SnapshotRootId, type TypedModelRef } from "behavon";
import { Account, InsufficientFundsError, type AccountInput, type AccountPort, type AccountScreenPort } from "./account";

export interface Transfer {
  readonly id: number;
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly fee: number;
}

export interface Failure {
  readonly id: number;
  readonly message: string;
}

export interface BankView {
  /** Transfers that went through, oldest first. */
  readonly transfers: readonly Transfer[];
  /** Transfers that were refused or rolled back, oldest first. */
  readonly failures: readonly Failure[];
}

export interface BankPort {
  view: SnapshotRootId<BankView>;
  transfer: Signal<[from: string, to: string, amount: number]>;
}

const bankPort = Behavon.createPort<BankPort>({
  view: Behavon.SnapshotType(),
  transfer: Behavon.SignalType(),
});

const states = Behavon.createId({ transfers: Behavon.StateType<readonly Transfer[]>() });

export interface BankInput {
  readonly accounts: Readonly<Record<string, TypedModelRef<Pick<AccountPort, "deposit" | "withdraw">>>>;
  /** Where the fee goes. */
  readonly feeAccount: string;
  readonly fee: number;
}

/**
 * Moves money between accounts in one transaction: the withdrawal, the deposit, the fee, and the record.
 * If any part fails, none of them happen.
 */
export const Bank: Model<BankInput, number, BankPort> = (input) => {
  const { accounts, feeAccount, fee } = input;
  const viewId = Behavon.useExport(bankPort, "view");
  const [transfers] = Behavon.useLabelState(states.transfers, []);
  const [failures, setFailures] = Behavon.useState<readonly Failure[]>([]);
  const lastId = Behavon.useMutable(0);

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => publish({ transfers, failures }), [failures, publish, transfers]);

  const transfer = Behavon.useCallback((from: string, to: string, amount: number) => {
    const id = lastId.get() + 1;
    lastId.set(id);
    const fail = (message: string) => setFailures((previous) => [...previous, { id, message }]);

    const source = accounts[from];
    const target = accounts[to];
    const feeTarget = accounts[feeAccount];
    if (source === undefined || target === undefined || feeTarget === undefined) return fail("없는 계좌");
    if (from === to || from === feeAccount || to === feeAccount) return fail("같은 계좌 사이에는 이체할 수 없음");
    if (!Number.isInteger(amount) || amount <= 0) return fail("금액은 1원 이상의 정수");

    const transactionId = Behavon.createId();
    Behavon.transaction.start(transactionId, [states.transfers]);
    try {
      Behavon.transaction.run(transactionId, ({ set }) => {
        target.deposit(amount);
        feeTarget.deposit(fee);
        set(states.transfers, (previous) => [...previous, { id, from, to, amount, fee }]);
        // Last, so a refusal also undoes the deposits above.
        source.withdraw(amount + fee);
      });
    } catch (reason) {
      // The error left `run`, so the whole transaction is already rolled back.
      if (!(reason instanceof InsufficientFundsError)) throw reason;
      return fail(reason.message);
    }
    Behavon.transaction.commit(transactionId);
  }, [accounts, fee, feeAccount, lastId, setFailures]);
  Behavon.useSignal(bankPort, "transfer", transfer);
  Behavon.useExport(bankPort, "transfer");

  return transfers.length;
};

export interface BankOptions {
  readonly accounts: Readonly<Record<string, AccountInput>>;
  readonly feeAccount: string;
  readonly fee: number;
}

/** Creates the accounts and the bank. `dispose` releases them in reverse order. */
export function createBank(options: BankOptions) {
  const entries = Object.entries(options.accounts).map(([id, account]) => [id, Behavon.createModel(Account, account)] as const);
  const accounts = Object.fromEntries(entries);
  const bank = Behavon.createModel(Bank, { accounts, feeAccount: options.feeAccount, fee: options.fee });
  const screen: TypedModelRef<BankPort> = bank;
  return {
    bank: screen,
    accounts: entries.map(([id, account]): { readonly id: string; readonly account: TypedModelRef<AccountScreenPort> } => ({ id, account })),
    dispose() {
      bank.dispose();
      for (const [, account] of entries.toReversed()) account.dispose();
    },
  };
}
