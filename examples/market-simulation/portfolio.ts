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
  const [cash, setCash] = Behavon.useLabelState(states.cash, trader.cash);
  const [holdings, setHoldings] = Behavon.useLabelState<Readonly<Record<string, number>>>(states.holdings, {});

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ traderId: trader.id, name: trader.name, cash, holdings });
  }, [cash, holdings, publish, trader.id, trader.name]);

  const buy = Behavon.useCallback((stockId: string, quantity: number, price: number) => {
    const id = Behavon.createId();
    Behavon.transaction.start(id, [states.cash, states.holdings]);
    Behavon.transaction.run(id, () => {
      if (cash < quantity * price) throw new OrderRefusedError(`현금 부족: ${cash} < ${quantity * price}`);
      setCash((current) => current - quantity * price);
      setHoldings((current) => ({ ...current, [stockId]: (current[stockId] ?? 0) + quantity }));
    });
    Behavon.transaction.commit(id);
  }, [cash, setCash, setHoldings]);
  Behavon.useSignal(portfolioPort, "buy", buy);
  Behavon.useExport(portfolioPort, "buy");

  const sell = Behavon.useCallback((stockId: string, quantity: number, price: number) => {
    const id = Behavon.createId();
    Behavon.transaction.start(id, [states.cash, states.holdings]);
    Behavon.transaction.run(id, () => {
      const owned = holdings[stockId] ?? 0;
      if (owned < quantity) throw new OrderRefusedError(`보유 부족: ${stockId} ${owned} < ${quantity}`);
      setHoldings((current) => ({ ...current, [stockId]: owned - quantity }));
      setCash((current) => current + quantity * price);
    });
    Behavon.transaction.commit(id);
  }, [holdings, setCash, setHoldings]);
  Behavon.useSignal(portfolioPort, "sell", sell);
  Behavon.useExport(portfolioPort, "sell");

  return cash;
};
