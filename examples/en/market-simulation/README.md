# Market simulation

An exchange where imaginary stocks and traders place orders step by step. Running the same scenario (seed) always gives the same result.

## What it shows

- A graph of many Models. The default scenario has 13: one clock (`Clock`), one exchange (`Exchange`), three companies (`Company`), four traders (`Trader`), and four portfolios (`Portfolio`).
- Companies and traders connect their own Slots to the clock's Signals directly with [`useConnect`](../../../docs/en/api/useConnect.md). No separate connecting Model is needed even though their number is not fixed.
- One step finishes synchronously inside `advance`
  1. `ticked` notifies every company, and the prices are collected through the request object's `report`
  2. `opened` sends the prices to every trader, and the orders are collected through `submit`
  3. The orders, sorted by trader, are passed to the exchange's `execute`
- Reproducibility: company price moves and trader decisions use only the seeded pseudo-random numbers (`random.ts`). Each participant gets its own seed, so the result does not depend on the order of answers.
- Order transactions: one order is one transaction. It changes the trade record (`useLabelState`) together with the portfolio's cash and holdings, and if the portfolio refuses (`OrderRefusedError`), all three are rolled back. Refusals are recorded with `useState` outside `run`.
- The screen receives it as the `ClockScreenPort` (`step`, `advance`) type, which holds only the members the screen uses

## Files

| File | Role |
| --- | --- |
| [scenario.ts](./scenario.ts) | The scenario, order, and per-step request (`TickRequest`, `MarketRequest`) types, and the default scenario. |
| [random.ts](./random.ts) | Seeded pseudo-random numbers and per-participant seeds. |
| [clock.ts](./clock.ts) | The `Clock` Model. The command `advance` and the step snapshot. |
| [company.ts](./company.ts) | The `Company` Model. Moves its price each step and reports it. |
| [trader.ts](./trader.ts) | The `Trader` Model. Strategies are momentum (`momentum`), contrarian (`contrarian`), and random (`random`). At most one order per step. |
| [portfolio.ts](./portfolio.ts) | The `Portfolio` Model. Cash and holdings, `buy` and `sell`. |
| [exchange.ts](./exchange.ts) | The `Exchange` Model. Order execution, prices, and the trade and refusal records. |
| [simulation.ts](./simulation.ts) | The assembly function `createSimulation`, and `runSimulation`, which runs N steps from the start. |
| [market-view.tsx](./market-view.tsx) | The step, the next-step button, prices, traders, and this step's trades and refusals. |
| [market-simulation.test.ts](./market-simulation.test.ts) | Checks the same result for the same seed, different results for different seeds, portfolios matching the trade record, no trace of refused orders, invalid orders, and consecutive orders from one trader. |
| [market-view.test.tsx](./market-view.test.tsx) | Runs one step on screen. |

## Note

- Leave time between steps for evaluation (`runSimulation` waits for `setTimeout(0)` each step). The result snapshot is published after the Model is evaluated again.

## Usage

```tsx
const simulation = createSimulation(defaultScenario)
root.render(<MarketView clock={simulation.clock} views={simulation.views} />)
// after unmounting the screen
simulation.dispose()

// reproduce without a screen
const result = await runSimulation(defaultScenario, 30)
```
