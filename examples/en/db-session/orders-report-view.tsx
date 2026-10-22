import { useState, useSyncExternalStore } from "react";
import Behavon, { type ResourcePhase, type TypedModelRef } from "behavon";
import type { OrdersReportPort, QueryStatus } from "./orders-report";

const connectionText: Record<ResourcePhase, string> = {
  opening: "Connecting…",
  open: "Connected",
  closing: "Closing…",
  closed: "Not connected",
};

const statusText: Record<QueryStatus, string> = {
  idle: "",
  running: "Querying…",
  done: "Query done",
  failed: "Query failed",
  cancelled: "Query cancelled",
};

export function OrdersReportView({ report }: { readonly report: TypedModelRef<OrdersReportPort> }) {
  const view = useSyncExternalStore(Behavon.subscribe(report.view), Behavon.getSnapshot(report.view));
  const [minTotal, setMinTotal] = useState("10000");
  if (view === undefined) return null;
  const open = view.connection === "open";
  return (
    <section>
      <p aria-label="Connection">{connectionText[view.connection]}</p>
      <form onSubmit={(event) => { event.preventDefault(); report.run(Number(minTotal)); }}>
        <input aria-label="Minimum total" inputMode="numeric" value={minTotal} onChange={(event) => setMinTotal(event.target.value)} />
        <button type="submit" disabled={!open || view.status === "running"}>Run query</button>
      </form>
      <button type="button" disabled={view.status !== "running"} onClick={() => report.cancel()}>Cancel</button>
      {view.connection === "closed"
        ? <button type="button" onClick={() => report.connect()}>Reconnect</button>
        : <button type="button" disabled={!open} onClick={() => report.close()}>Close connection</button>}
      <p role="status">{statusText[view.status]}</p>
      {view.error !== undefined && <p role="alert">{view.error}</p>}
      <table>
        <tbody>
          {view.rows.map((row) => (
            <tr key={String(row.id)}>
              <td>{String(row.customer)}</td>
              <td>{String(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
