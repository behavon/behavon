import Behavon, { type ResourceAbortSignal } from "behavon";

export type Row = Readonly<Record<string, unknown>>;

/** A database connection as the driver provides it. */
export interface Connection {
  query(sql: string, params: readonly unknown[], signal: AbortSignal): Promise<readonly Row[]>;
  /** Closes after the running queries finish. */
  close(): Promise<void>;
  /** Closes at once. */
  destroy(): void;
}

export interface DatabaseDriver {
  connect(url: string, signal: AbortSignal): Promise<Connection>;
}

export interface DbSessionInput {
  readonly url: string;
  readonly driver: DatabaseDriver;
}

/** A database session as a Resource. `query` runs only while the session is open. */
export const DbSession = Behavon.createResource({
  open: ({ input, signal }: { input: DbSessionInput; signal: ResourceAbortSignal }) =>
    input.driver.connect(input.url, signal),
  close: ({ resource }: { resource: Connection }) => resource.close(),
  abort: ({ resource }: { resource: Connection | undefined }) => {
    resource?.destroy();
  },
  actions: {
    query: ({ resource, signal }: { resource: Connection; signal: ResourceAbortSignal }, sql: string, params: readonly unknown[]) =>
      resource.query(sql, params, signal),
  },
});
