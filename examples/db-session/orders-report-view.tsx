import { useState, useSyncExternalStore } from "react";
import Behavon, { type ResourcePhase, type TypedModelRef } from "behavon";
import type { OrdersReportPort, QueryStatus } from "./orders-report";

const connectionText: Record<ResourcePhase, string> = {
  opening: "연결 중…",
  open: "연결됨",
  closing: "닫는 중…",
  closed: "연결 안 됨",
};

const statusText: Record<QueryStatus, string> = {
  idle: "",
  running: "조회 중…",
  done: "조회 완료",
  failed: "조회 실패",
  cancelled: "조회 취소됨",
};

export function OrdersReportView({ report }: { readonly report: TypedModelRef<OrdersReportPort> }) {
  const view = useSyncExternalStore(Behavon.subscribe(report.view), Behavon.getSnapshot(report.view));
  const [minTotal, setMinTotal] = useState("10000");
  if (view === undefined) return null;
  const open = view.connection === "open";
  return (
    <section>
      <p aria-label="연결">{connectionText[view.connection]}</p>
      <form onSubmit={(event) => { event.preventDefault(); report.run(Number(minTotal)); }}>
        <input aria-label="최소 금액" inputMode="numeric" value={minTotal} onChange={(event) => setMinTotal(event.target.value)} />
        <button type="submit" disabled={!open || view.status === "running"}>조회</button>
      </form>
      <button type="button" disabled={view.status !== "running"} onClick={() => report.cancel()}>취소</button>
      {view.connection === "closed"
        ? <button type="button" onClick={() => report.connect()}>다시 연결</button>
        : <button type="button" disabled={!open} onClick={() => report.close()}>연결 닫기</button>}
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
