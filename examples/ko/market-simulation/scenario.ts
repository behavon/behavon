export type Strategy = "momentum" | "contrarian" | "random";

export interface StockScenario {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  /** The largest change in one step. */
  readonly swing: number;
}

export interface TraderScenario {
  readonly id: string;
  readonly name: string;
  readonly cash: number;
  readonly strategy: Strategy;
}

export interface Scenario {
  readonly seed: number;
  readonly stocks: readonly StockScenario[];
  readonly traders: readonly TraderScenario[];
}

export const defaultScenario: Scenario = {
  seed: 20_261_020,
  stocks: [
    { id: "ACME", name: "에이스", price: 100, swing: 6 },
    { id: "BOLT", name: "볼트", price: 40, swing: 3 },
    { id: "CORE", name: "코어", price: 250, swing: 12 },
  ],
  traders: [
    { id: "t1", name: "추세", cash: 2_000, strategy: "momentum" },
    { id: "t2", name: "역추세", cash: 2_000, strategy: "contrarian" },
    { id: "t3", name: "무작위 A", cash: 1_000, strategy: "random" },
    { id: "t4", name: "무작위 B", cash: 500, strategy: "random" },
  ],
};

/** One order. `price` is the price of the step the order was made in. */
export interface Order {
  readonly traderId: string;
  readonly stockId: string;
  readonly side: "buy" | "sell";
  readonly quantity: number;
}

export type Prices = Readonly<Record<string, number>>;

/** Sent to every company once per step. */
export interface TickRequest {
  readonly step: number;
  report(stockId: string, price: number): void;
}

/** Sent to every trader once per step, after the prices are known. */
export interface MarketRequest {
  readonly step: number;
  readonly prices: Prices;
  submit(order: Order): void;
}
