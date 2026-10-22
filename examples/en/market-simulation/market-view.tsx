import { useSyncExternalStore } from "react";
import Behavon, { type SnapshotId, type TypedModelRef } from "behavon";
import type { ClockScreenPort } from "./clock";
import type { ExchangeView } from "./exchange";
import type { PortfolioView } from "./portfolio";

function useView<Value>(id: SnapshotId<Value>): Value | undefined {
  return useSyncExternalStore(Behavon.subscribe(id), Behavon.getSnapshot(id));
}

function PortfolioRow({ id }: { readonly id: SnapshotId<PortfolioView> }) {
  const view = useView(id);
  if (view === undefined) return null;
  const holdings = Object.entries(view.holdings).filter(([, count]) => count > 0).map(([stockId, count]) => `${stockId} ${count}`);
  return (
    <tr>
      <td>{view.name}</td>
      <td>{view.cash}</td>
      <td>{holdings.join(", ") || "-"}</td>
    </tr>
  );
}

export interface MarketViewProps {
  readonly clock: TypedModelRef<ClockScreenPort>;
  readonly views: {
    readonly exchange: SnapshotId<ExchangeView>;
    readonly portfolios: readonly SnapshotId<PortfolioView>[];
  };
}

export function MarketView({ clock, views }: MarketViewProps) {
  const step = useView(clock.step);
  const exchange = useView(views.exchange);
  if (step === undefined || exchange === undefined) return null;
  const latest = exchange.trades.filter((trade) => trade.step === step);
  const refused = exchange.refusals.filter((refusal) => refusal.step === step);
  return (
    <main>
      <p role="status">Step {step}</p>
      <button type="button" onClick={() => clock.advance()}>Next step</button>
      <ul aria-label="Prices">
        {Object.entries(exchange.prices).map(([stockId, price]) => <li key={stockId}>{stockId} {price}</li>)}
      </ul>
      <table aria-label="Traders">
        <thead><tr><th>Name</th><th>Cash</th><th>Holdings</th></tr></thead>
        {/* The list of portfolios never changes, so the position is a stable key. */}
        <tbody>{views.portfolios.map((id, index) => <PortfolioRow key={index} id={id} />)}</tbody>
      </table>
      <ol aria-label="Trades this step">
        {latest.map((trade, index) => (
          <li key={index}>{trade.traderId} {trade.side === "buy" ? "buys" : "sells"} {trade.stockId} {trade.quantity} shares @ {trade.price}</li>
        ))}
      </ol>
      <ol aria-label="Refusals this step">
        {refused.map((refusal, index) => <li key={index}>{refusal.traderId} {refusal.stockId}: {refusal.reason}</li>)}
      </ol>
    </main>
  );
}
