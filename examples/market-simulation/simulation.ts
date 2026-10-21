import Behavon, { type TypedModelRef } from "behavon";
import { Clock, type ClockScreenPort } from "./clock";
import { Company } from "./company";
import { Exchange, type ExchangeView } from "./exchange";
import { Portfolio, type PortfolioView } from "./portfolio";
import { seedFor } from "./random";
import type { Scenario } from "./scenario";
import { Trader } from "./trader";

/**
 * Creates the portfolios, the exchange, the clock, the companies, and the traders.
 * `dispose` releases them in reverse order.
 */
export function createSimulation(scenario: Scenario) {
  const portfolios = scenario.traders.map((trader) => [trader.id, Behavon.createModel(Portfolio, trader)] as const);
  const exchange = Behavon.createModel(Exchange, { portfolios: Object.fromEntries(portfolios) });
  const clock = Behavon.createModel(Clock, { exchange });
  const companies = scenario.stocks.map((stock, index) =>
    Behavon.createModel(Company, { stock, seed: seedFor(scenario.seed, index), clock }));
  const traders = scenario.traders.map((trader, index) =>
    Behavon.createModel(Trader, { trader, seed: seedFor(scenario.seed, scenario.stocks.length + index), clock }));

  const screenClock: TypedModelRef<ClockScreenPort> = clock;
  const views = {
    exchange: exchange.view,
    portfolios: portfolios.map(([, portfolio]) => portfolio.view),
  };
  return {
    clock: screenClock,
    views,
    /** The current result. Read it after the step has settled. */
    summary(): { readonly exchange: ExchangeView | undefined; readonly portfolios: readonly (PortfolioView | undefined)[] } {
      return {
        exchange: Behavon.getSnapshot(views.exchange)(),
        portfolios: views.portfolios.map((id) => Behavon.getSnapshot(id)()),
      };
    },
    dispose() {
      for (const model of [...traders, ...companies].toReversed()) model.dispose();
      clock.dispose();
      exchange.dispose();
      for (const [, portfolio] of portfolios.toReversed()) portfolio.dispose();
    },
  };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Runs `steps` steps from the start and returns the result. The same scenario always gives the same result. */
export async function runSimulation(scenario: Scenario, steps: number) {
  const simulation = createSimulation(scenario);
  try {
    await settle();
    for (let step = 0; step < steps; step += 1) {
      simulation.clock.advance();
      await settle();
    }
    return simulation.summary();
  } finally {
    simulation.dispose();
  }
}
