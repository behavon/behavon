import Behavon, { type Model, type Slot, type TypedModelRef } from "behavon";
import type { ClockPort } from "./clock";
import { nextRandom } from "./random";
import type { MarketRequest, Order, Prices, TraderScenario } from "./scenario";

export interface TraderPort {
  market: Slot<[request: MarketRequest]>;
}

const traderPort = Behavon.createPort<TraderPort>({ market: Behavon.SlotType() });

export interface TraderInput {
  readonly trader: TraderScenario;
  readonly seed: number;
  readonly clock: TypedModelRef<Pick<ClockPort, "opened">>;
}

/** The stock that moved the most since the last step, and by how much. */
function biggestMove(previous: Prices, prices: Prices): readonly [stockId: string, change: number] | undefined {
  let found: readonly [string, number] | undefined;
  for (const stockId of Object.keys(prices).sort()) {
    const before = previous[stockId];
    if (before === undefined) continue;
    const change = prices[stockId] - before;
    if (found === undefined || Math.abs(change) > Math.abs(found[1])) found = [stockId, change];
  }
  return found;
}

/**
 * Decides at most one order per step.
 * momentum follows the biggest move, contrarian goes against it, random picks anything.
 */
export const Trader: Model<TraderInput, undefined, TraderPort> = (input) => {
  const { trader } = input;
  const lastPrices = Behavon.useMutable<Prices>({});
  const random = Behavon.useMutable(input.seed);

  const draw = Behavon.useCallback(() => {
    const [state, value] = nextRandom(random.get());
    random.set(state);
    return value;
  }, [random]);

  const market = Behavon.useCallback((request: MarketRequest) => {
    const quantity = 1 + Math.floor(draw() * 3);
    const order = (stockId: string, side: Order["side"]): Order => ({ traderId: trader.id, stockId, side, quantity });
    let decided: Order | undefined;
    if (trader.strategy === "random") {
      const stocks = Object.keys(request.prices).sort();
      const stockId = stocks[Math.floor(draw() * stocks.length)];
      if (stockId !== undefined) decided = order(stockId, draw() < 0.5 ? "buy" : "sell");
    } else {
      const move = biggestMove(lastPrices.get(), request.prices);
      if (move !== undefined && move[1] !== 0) {
        const rising = move[1] > 0;
        const buy = trader.strategy === "momentum" ? rising : !rising;
        decided = order(move[0], buy ? "buy" : "sell");
      }
    }
    lastPrices.set(request.prices);
    if (decided !== undefined) request.submit(decided);
  }, [draw, lastPrices, trader]);
  const slot = Behavon.useSlot(traderPort, "market", market);

  const clock = Behavon.usePort(input.clock);
  Behavon.useConnect(clock.opened, slot);
  return undefined;
};
