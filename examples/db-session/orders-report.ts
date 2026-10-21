import Behavon, {
  ResourceActionSupersededError,
  type Model,
  type ResourcePhase,
  type Signal,
  type SnapshotRootId,
} from "behavon";
import { DbSession, type DatabaseDriver, type Row } from "./db-session";

export type QueryStatus = "idle" | "running" | "done" | "failed" | "cancelled";

export interface OrdersReportView {
  readonly connection: ResourcePhase;
  readonly status: QueryStatus;
  readonly rows: readonly Row[];
  readonly error: string | undefined;
}

export interface OrdersReportPort {
  view: SnapshotRootId<OrdersReportView>;
  run: Signal<[minTotal: number]>;
  cancel: Signal;
  close: Signal;
  connect: Signal;
}

const reportPort = Behavon.createPort<OrdersReportPort>({
  view: Behavon.SnapshotType(),
  run: Behavon.SignalType(),
  cancel: Behavon.SignalType(),
  close: Behavon.SignalType(),
  connect: Behavon.SignalType(),
});

export const ordersQuery = "select id, customer, total from orders where total >= ? order by total desc";

export interface OrdersReportInput {
  readonly url: string;
  readonly driver: DatabaseDriver;
}

interface QueryResult {
  readonly status: QueryStatus;
  readonly rows: readonly Row[];
  readonly error: string | undefined;
}

const idle: QueryResult = { status: "idle", rows: [], error: undefined };

/** Lists the orders above an amount. Cancelling aborts the session; a late result is not shown. */
export const OrdersReport: Model<OrdersReportInput, QueryStatus, OrdersReportPort> = (input) => {
  const { url, driver } = input;
  const viewId = Behavon.useExport(reportPort, "view");
  const sessionInput = Behavon.useMemo(() => ({ url, driver }), [driver, url]);
  const [connection, session] = Behavon.useResource(DbSession, sessionInput);
  const [result, setResult] = Behavon.useState<QueryResult>(idle);
  const running = Behavon.useMutable(false);

  Behavon.useEffect(() => {
    session.open();
    return () => {
      session.abort();
    };
  }, [session]);

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ connection: connection.phase, ...result });
  }, [connection.phase, publish, result]);

  const run = Behavon.useCallback(async (minTotal: number) => {
    if (running.get() || connection.phase !== "open") return;
    running.set(true);
    setResult((previous) => ({ ...previous, status: "running", error: undefined }));
    let rows: readonly Row[];
    try {
      rows = await session.query(ordersQuery, [minTotal]);
    } catch (reason) {
      // Cancelling or disposing aborts the session. Its query then settles with
      // ResourceActionSupersededError, even when the driver answers late, and is ignored here.
      if (reason instanceof ResourceActionSupersededError) return;
      running.set(false);
      setResult((previous) => ({
        ...previous,
        status: "failed",
        error: reason instanceof Error ? reason.message : String(reason),
      }));
      return;
    }
    running.set(false);
    setResult({ status: "done", rows, error: undefined });
  }, [connection.phase, running, session, setResult]);
  Behavon.useSignal(reportPort, "run", run);
  Behavon.useExport(reportPort, "run");

  const cancel = Behavon.useCallback(() => {
    if (!running.get()) return;
    running.set(false);
    setResult((previous) => ({ ...previous, status: "cancelled" }));
    session.abort();
  }, [running, session, setResult]);
  Behavon.useSignal(reportPort, "cancel", cancel);
  Behavon.useExport(reportPort, "cancel");

  const close = Behavon.useCallback(() => {
    session.close();
  }, [session]);
  Behavon.useSignal(reportPort, "close", close);
  Behavon.useExport(reportPort, "close");

  const connect = Behavon.useCallback(() => {
    session.open();
  }, [session]);
  Behavon.useSignal(reportPort, "connect", connect);
  Behavon.useExport(reportPort, "connect");

  return result.status;
};
