import Behavon, { type Model, type Slot, type TypedModelRef } from "behavon";
import type { ClockPort } from "./clock";
import { nextRandom } from "./random";
import type { StockScenario, TickRequest } from "./scenario";

export interface CompanyPort {
  tick: Slot<[request: TickRequest]>;
}

const companyPort = Behavon.createPort<CompanyPort>({ tick: Behavon.SlotType() });

export interface CompanyInput {
  readonly stock: StockScenario;
  readonly seed: number;
  readonly clock: TypedModelRef<Pick<ClockPort, "ticked">>;
}

/** Moves its stock's price by a random amount each step and reports it. */
export const Company: Model<CompanyInput, undefined, CompanyPort> = (input) => {
  const { stock } = input;
  const price = Behavon.useMutable(stock.price);
  const random = Behavon.useMutable(input.seed);

  const tick = Behavon.useCallback((request: TickRequest) => {
    const [state, value] = nextRandom(random.get());
    random.set(state);
    const change = Math.floor(value * (stock.swing * 2 + 1)) - stock.swing;
    price.set(Math.max(1, price.get() + change));
    request.report(stock.id, price.get());
  }, [price, random, stock]);
  const slot = Behavon.useSlot(companyPort, "tick", tick);

  const clock = Behavon.usePort(input.clock);
  Behavon.useConnect(clock.ticked, slot);
  return undefined;
};
