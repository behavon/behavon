import Behavon, { type Model, type Signal, type SnapshotRootId, type TypedModelRef } from "behavon";
import type { ExchangePort } from "./exchange";
import type { MarketRequest, Order, TickRequest } from "./scenario";

export interface ClockPort {
  step: SnapshotRootId<number>;
  advance: Signal;
  /** Companies connect to it and report their price. */
  ticked: Signal<[request: TickRequest]>;
  /** Traders connect to it and submit their order. */
  opened: Signal<[request: MarketRequest]>;
}

const clockPort = Behavon.createPort<ClockPort>({
  step: Behavon.SnapshotType(),
  advance: Behavon.SignalType(),
  ticked: Behavon.SignalType(),
  opened: Behavon.SignalType(),
});

/** What the screen uses. */
export type ClockScreenPort = Pick<ClockPort, "step" | "advance">;

export interface ClockInput {
  readonly exchange: TypedModelRef<Pick<ExchangePort, "execute">>;
}

const byTrader = (left: Order, right: Order) => (left.traderId < right.traderId ? -1 : left.traderId > right.traderId ? 1 : 0);

/**
 * Runs one step at a time: collects the prices from the companies, then the orders from the traders,
 * then hands both to the exchange. The whole step runs synchronously inside `advance`.
 */
export const Clock: Model<ClockInput, number, ClockPort> = (input) => {
  const { exchange } = input;
  const stepId = Behavon.useExport(clockPort, "step");
  const [step, setStep] = Behavon.useState(0);
  const lastStep = Behavon.useMutable(0);

  const [, publish] = Behavon.useSnapshot(stepId);
  Behavon.useEffect(() => publish(step), [publish, step]);

  const tickedBody = Behavon.useCallback((_request: TickRequest) => undefined, []);
  const ticked = Behavon.useSignal(clockPort, "ticked", tickedBody);
  Behavon.useExport(clockPort, "ticked");
  const openedBody = Behavon.useCallback((_request: MarketRequest) => undefined, []);
  const opened = Behavon.useSignal(clockPort, "opened", openedBody);
  Behavon.useExport(clockPort, "opened");

  const advance = Behavon.useCallback(() => {
    const current = lastStep.get() + 1;
    lastStep.set(current);

    const prices: Record<string, number> = {};
    ticked({ step: current, report: (stockId, price) => { prices[stockId] = price; } });
    const frozen = Object.freeze({ ...prices });

    const orders: Order[] = [];
    opened({ step: current, prices: frozen, submit: (order) => { orders.push(order); } });

    // Sorted, so the result does not depend on the order the traders answered in.
    exchange.execute(current, frozen, orders.toSorted(byTrader));
    setStep(current);
  }, [exchange, lastStep, opened, setStep, ticked]);
  Behavon.useSignal(clockPort, "advance", advance);
  Behavon.useExport(clockPort, "advance");

  return step;
};
