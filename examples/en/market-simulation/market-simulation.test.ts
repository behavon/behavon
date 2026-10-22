import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { Exchange } from "./exchange";
import { Portfolio } from "./portfolio";
import { defaultScenario } from "./scenario";
import { createSimulation, runSimulation } from "./simulation";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("market-simulation", () => {
  it("gives the same result for the same scenario", async () => {
    const first = await runSimulation(defaultScenario, 30);
    const second = await runSimulation(defaultScenario, 30);
    expect(second).toEqual(first);
    expect(first.exchange?.step).toBe(30);
    expect(first.exchange?.trades.length).toBeGreaterThan(0);
    expect(first.exchange?.refusals.length).toBeGreaterThan(0);
  });

  it("gives a different result for a different seed", async () => {
    const first = await runSimulation(defaultScenario, 30);
    const other = await runSimulation({ ...defaultScenario, seed: 1 }, 30);
    expect(other.exchange?.prices).not.toEqual(first.exchange?.prices);
  });

  it("ends with portfolios that match the trade record exactly", async () => {
    const { exchange, portfolios } = await runSimulation(defaultScenario, 50);
    for (const trader of defaultScenario.traders) {
      let cash = trader.cash;
      const holdings: Record<string, number> = {};
      for (const trade of exchange?.trades ?? []) {
        if (trade.traderId !== trader.id) continue;
        const sign = trade.side === "buy" ? 1 : -1;
        cash -= sign * trade.quantity * trade.price;
        holdings[trade.stockId] = (holdings[trade.stockId] ?? 0) + sign * trade.quantity;
      }
      const portfolio = portfolios.find((item) => item?.traderId === trader.id);
      expect(portfolio?.cash).toBe(cash);
      expect(portfolio?.holdings).toEqual(holdings);
      expect(cash).toBeGreaterThanOrEqual(0);
      expect(Object.values(holdings).every((count) => count >= 0)).toBe(true);
    }
  });

  it("leaves no trace of a refused order", async () => {
    const simulation = createSimulation(defaultScenario);
    await settle();
    simulation.clock.advance();
    await settle();
    const { exchange, portfolios } = simulation.summary();
    // On the first step the random traders try to sell shares they do not have yet.
    const refused = exchange?.refusals.filter((refusal) => refusal.step === 1) ?? [];
    expect(refused.map(({ traderId, side, reason }) => [traderId, side, reason.startsWith("Not enough shares")])).toEqual([
      ["t3", "sell", true],
      ["t4", "sell", true],
    ]);
    for (const { traderId } of refused) {
      expect(exchange?.trades.some((trade) => trade.traderId === traderId)).toBe(false);
      const scenario = defaultScenario.traders.find((trader) => trader.id === traderId);
      expect(portfolios.find((item) => item?.traderId === traderId)).toMatchObject({ cash: scenario?.cash, holdings: {} });
    }
    simulation.dispose();
  });

  it("refuses an order for an unknown trader or stock", async () => {
    const trader = defaultScenario.traders[0];
    const portfolio = Behavon.createModel(Portfolio, trader);
    const exchange = Behavon.createModel(Exchange, { portfolios: { [trader.id]: portfolio } });
    exchange.execute(1, { ACME: 100 }, [
      { traderId: "nobody", stockId: "ACME", side: "buy", quantity: 1 },
      { traderId: trader.id, stockId: "NONE", side: "buy", quantity: 1 },
      { traderId: trader.id, stockId: "ACME", side: "buy", quantity: 2 },
    ]);
    await settle();
    const view = Behavon.getSnapshot(exchange.view)();
    expect(view?.refusals.map((refusal) => refusal.reason)).toEqual(["Unknown trader or stock", "Unknown trader or stock"]);
    expect(view?.trades).toEqual([{ traderId: trader.id, stockId: "ACME", side: "buy", quantity: 2, step: 1, price: 100 }]);
    expect(Behavon.getSnapshot(portfolio.view)()).toMatchObject({ cash: trader.cash - 200, holdings: { ACME: 2 } });
    exchange.dispose();
    portfolio.dispose();
  });

  it("processes two orders of one trader in a step one after the other", async () => {
    const trader = { id: "t1", name: "Momentum", cash: 300, strategy: "momentum" } as const;
    const portfolio = Behavon.createModel(Portfolio, trader);
    const exchange = Behavon.createModel(Exchange, { portfolios: { t1: portfolio } });
    exchange.execute(1, { ACME: 100 }, [
      { traderId: "t1", stockId: "ACME", side: "buy", quantity: 2 },
      { traderId: "t1", stockId: "ACME", side: "buy", quantity: 2 },
    ]);
    await settle();
    expect(Behavon.getSnapshot(exchange.view)()?.refusals.map((refusal) => refusal.reason)).toEqual(["Not enough cash: 100 < 200"]);
    expect(Behavon.getSnapshot(portfolio.view)()).toMatchObject({ cash: 100, holdings: { ACME: 2 } });
    exchange.dispose();
    portfolio.dispose();
  });
});
