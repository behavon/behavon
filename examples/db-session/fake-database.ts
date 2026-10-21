import type { Connection, DatabaseDriver, Row } from "./db-session";

interface PendingQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly signal: AbortSignal;
  answer(rows: readonly Row[]): void;
  fail(message: string): void;
}

/**
 * A database driver whose connections and queries the test completes by hand.
 * A query rejects when its signal aborts, unless `ignoresAbort` imitates a driver that does not.
 */
export function createFakeDatabase(options: { readonly ignoresAbort?: boolean } = {}) {
  const queries: PendingQuery[] = [];
  const events: string[] = [];
  let accept: (() => void) | undefined;

  const driver: DatabaseDriver = {
    connect(url, signal) {
      events.push(`connect ${url}`);
      return new Promise<Connection>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        accept = () => resolve({
          query(sql, params, querySignal) {
            return new Promise((answer, fail) => {
              if (!options.ignoresAbort) {
                querySignal.addEventListener("abort", () => fail(querySignal.reason), { once: true });
              }
              queries.push({ sql, params, signal: querySignal, answer, fail: (message) => fail(new Error(message)) });
            });
          },
          async close() {
            events.push("close");
          },
          destroy() {
            events.push("destroy");
          },
        });
      });
    },
  };

  return {
    driver,
    events,
    /** Completes the pending connection. */
    accept() {
      accept?.();
    },
    latestQuery(): PendingQuery {
      const query = queries.at(-1);
      if (query === undefined) throw new Error("no query was run");
      return query;
    },
    queryCount: () => queries.length,
  };
}
