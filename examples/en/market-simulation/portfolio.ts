import Behavon, { type Model, type Signal, type SnapshotRootId } from "behavon";
import type { TraderScenario } from "./scenario";

export class OrderRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderRefusedError";
  }
}

export interface PortfolioView {
  readonly traderId: string;
  readonly name: string;
  readonly cash: number;
  readonly holdings: Readonly<Record<string, number>>;
}

export interface PortfolioPort {
  view: SnapshotRootId<PortfolioView>;
  buy: Signal<[stockId: string, quantity: number, price: number]>;
  sell: Signal<[stockId: string, quantity: number, price: number]>;
}

const portfolioPort = Behavon.createPort<PortfolioPort>({
  view: Behavon.SnapshotType(),
  buy: Behavon.SignalType(),
  sell: Behavon.SignalType(),
});

const states = Behavon.createId({
  cash: Behavon.StateType<number>(),
  holdings: Behavon.StateType<Readonly<Record<string, number>>>(),
});

/** One trader's cash and shares. Buying and selling change both in one transaction. */
export const Portfolio: Model<TraderScenario, number, PortfolioPort> = (trader) => {
  const viewId = Behavon.useExport(portfolioPort, "view");
  const [cash] = Behavon.useLabelState(states.cash, trader.cash);
  const [holdings] = Behavon.useLabelState<Readonly<Record<string, number>>>(states.holdings, {});

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ traderId: trader.id, name: trader.name, cash, holdings });
  }, [cash, holdings, publish, trader.id, trader.name]);

  const buy = Behavon.useCallback((stockId: string, quantity: number, price: number) => {
    const id = Behavon.createId();
    Behavon.transaction.start(id, [states.cash, states.holdings]);
    Behavon.transaction.run(id, ({ get, set }) => {
      const current = get(states.cash);
      if (current < quantity * price) throw new OrderRefusedError(`Not enough cash: ${current} < ${quantity * price}`);
      set(states.cash, current - quantity * price);
      set(states.holdings, (last) => ({ ...last, [stockId]: (last[stockId] ?? 0) + quantity }));
    });
    Behavon.transaction.commit(id);
  }, []);
  Behavon.useSignal(portfolioPort, "buy", buy);
  Behavon.useExport(portfolioPort, "buy");

  const sell = Behavon.useCallback((stockId: string, quantity: number, price: number) => {
    const id = Behavon.createId();
    Behavon.transaction.start(id, [states.cash, states.holdings]);
    Behavon.transaction.run(id, ({ get, set }) => {
      const owned = get(states.holdings)[stockId] ?? 0;
      if (owned < quantity) throw new OrderRefusedError(`Not enough shares: ${stockId} ${owned} < ${quantity}`);
      set(states.holdings, (last) => ({ ...last, [stockId]: owned - quantity }));
      set(states.cash, (last) => last + quantity * price);
    });
    Behavon.transaction.commit(id);
  }, []);
  Behavon.useSignal(portfolioPort, "sell", sell);
  Behavon.useExport(portfolioPort, "sell");

  return cash;
};
