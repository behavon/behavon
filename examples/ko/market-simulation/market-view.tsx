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
      <p role="status">단계 {step}</p>
      <button type="button" onClick={() => clock.advance()}>다음 단계</button>
      <ul aria-label="가격">
        {Object.entries(exchange.prices).map(([stockId, price]) => <li key={stockId}>{stockId} {price}</li>)}
      </ul>
      <table aria-label="투자자">
        <thead><tr><th>이름</th><th>현금</th><th>보유</th></tr></thead>
        {/* The list of portfolios never changes, so the position is a stable key. */}
        <tbody>{views.portfolios.map((id, index) => <PortfolioRow key={index} id={id} />)}</tbody>
      </table>
      <ol aria-label="이번 단계 체결">
        {latest.map((trade, index) => (
          <li key={index}>{trade.traderId} {trade.side === "buy" ? "매수" : "매도"} {trade.stockId} {trade.quantity}주 @ {trade.price}</li>
        ))}
      </ol>
      <ol aria-label="이번 단계 거부">
        {refused.map((refusal, index) => <li key={index}>{refusal.traderId} {refusal.stockId}: {refusal.reason}</li>)}
      </ol>
    </main>
  );
}
