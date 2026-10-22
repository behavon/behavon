import Behavon, { type Model, type Signal, type SnapshotRootId, type TypedModelRef } from "behavon";
import { OrderRefusedError, type PortfolioPort } from "./portfolio";
import type { Order, Prices } from "./scenario";

export interface Trade extends Order {
  readonly step: number;
  readonly price: number;
}

export interface Refusal extends Order {
  readonly step: number;
  readonly reason: string;
}

export interface ExchangeView {
  readonly step: number;
  readonly prices: Prices;
  /** Every trade, oldest first. */
  readonly trades: readonly Trade[];
  /** Every refused order, oldest first. */
  readonly refusals: readonly Refusal[];
}

export interface ExchangePort {
  view: SnapshotRootId<ExchangeView>;
  execute: Signal<[step: number, prices: Prices, orders: readonly Order[]]>;
}

const exchangePort = Behavon.createPort<ExchangePort>({
  view: Behavon.SnapshotType(),
  execute: Behavon.SignalType(),
});

const states = Behavon.createId({ trades: Behavon.StateType<readonly Trade[]>() });

export interface ExchangeInput {
  readonly portfolios: Readonly<Record<string, TypedModelRef<Pick<PortfolioPort, "buy" | "sell">>>>;
}

/** Executes the orders of a step in order. Each order is one transaction with the trader's portfolio. */
export const Exchange: Model<ExchangeInput, number, ExchangePort> = (input) => {
  const { portfolios } = input;
  const viewId = Behavon.useExport(exchangePort, "view");
  const [market, setMarket] = Behavon.useState<{ readonly step: number; readonly prices: Prices }>({ step: 0, prices: {} });
  const [trades] = Behavon.useLabelState(states.trades, []);
  const [refusals, setRefusals] = Behavon.useState<readonly Refusal[]>([]);

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ ...market, trades, refusals });
  }, [market, publish, refusals, trades]);

  const execute = Behavon.useCallback((step: number, prices: Prices, orders: readonly Order[]) => {
    setMarket({ step, prices });
    for (const order of orders) {
      const portfolio = portfolios[order.traderId];
      const price = prices[order.stockId];
      if (portfolio === undefined || price === undefined) {
        setRefusals((previous) => [...previous, { ...order, step, reason: "Unknown trader or stock" }]);
        continue;
      }
      const id = Behavon.createId();
      Behavon.transaction.start(id, [states.trades]);
      try {
        Behavon.transaction.run(id, ({ set }) => {
          set(states.trades, (previous) => [...previous, { ...order, step, price }]);
          portfolio[order.side](order.stockId, order.quantity, price);
        });
      } catch (reason) {
        // The refusal left `run`, so the portfolio change and the trade record are both undone.
        if (!(reason instanceof OrderRefusedError)) throw reason;
        setRefusals((previous) => [...previous, { ...order, step, reason: reason.message }]);
        continue;
      }
      Behavon.transaction.commit(id);
    }
  }, [portfolios, setMarket, setRefusals]);
  Behavon.useSignal(exchangePort, "execute", execute);
  Behavon.useExport(exchangePort, "execute");

  return trades.length;
};
