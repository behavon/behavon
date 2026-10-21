import Behavon, { FutureCancellationError, type Model, type Signal, type SnapshotRootId } from "behavon";

/** The search server. It should stop when `signal` aborts. */
export interface SearchApi {
  search(query: string, signal: AbortSignal): Promise<readonly string[]>;
}

export type SearchStatus = "idle" | "searching" | "done" | "failed";

export interface SearchView {
  readonly query: string;
  readonly status: SearchStatus;
  /** The latest results. They stay on screen while a newer search runs. */
  readonly results: readonly string[];
  readonly error: string | undefined;
  /** What happened, oldest first. */
  readonly log: readonly string[];
}

export interface SearchPort {
  view: SnapshotRootId<SearchView>;
  search: Signal<[query: string]>;
}

const searchPort = Behavon.createPort<SearchPort>({
  view: Behavon.SnapshotType(),
  search: Behavon.SignalType(),
});

const noResults: readonly string[] = Object.freeze([]);

function describeRejection(query: string, reason: unknown): string {
  if (reason instanceof FutureCancellationError) return `취소: ${query}`;
  return `실패: ${query} (${reason instanceof Error ? reason.message : String(reason)})`;
}

/** Searches as the query changes. A newer query cancels the one still running. */
export const Search: Model<SearchApi, SearchStatus, SearchPort> = (api) => {
  const viewId = Behavon.useExport(searchPort, "view");
  const [query, setQuery] = Behavon.useState("");
  const [results, setResults] = Behavon.useState<readonly string[]>([]);
  const [log, setLog] = Behavon.useState<readonly string[]>([]);

  const request = Behavon.useFuture(
    (text: string, { signal }) => api.search(text, signal),
    { concurrency: "latest" },
  );
  const snapshot = request.snapshot();

  Behavon.useEffect(() => {
    const record = (line: string) => setLog((lines) => [...lines, line]);
    const offPending = request.pending.subscribe(({ input }) => record(`시작: ${input}`));
    const offFulfilled = request.fulfilled.subscribe(({ input, value }) => {
      setResults(value);
      record(`완료: ${input} (${value.length}건)`);
    });
    const offRejected = request.rejected.subscribe(({ input, reason }) => record(describeRejection(input, reason)));
    return () => {
      offPending();
      offFulfilled();
      offRejected();
    };
  }, [request, setLog, setResults]);

  const status: SearchStatus =
    query.trim() === "" ? "idle"
    : snapshot.status === "fulfilled" ? "done"
    : snapshot.status === "rejected" && !(snapshot.reason instanceof FutureCancellationError) ? "failed"
    : "searching";
  const error = status === "failed" && snapshot.status === "rejected"
    ? (snapshot.reason instanceof Error ? snapshot.reason.message : String(snapshot.reason))
    : undefined;
  const shown = status === "idle" ? noResults : results;

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ query, status, results: shown, error, log });
  }, [error, log, publish, query, shown, status]);

  const search = Behavon.useCallback((text: string) => {
    setQuery(text);
    if (text.trim() === "") {
      request.abort();
      return;
    }
    // A superseded or cancelled run rejects its Promise; the log already records it.
    request.start(text.trim()).catch(() => undefined);
  }, [request, setQuery]);
  Behavon.useSignal(searchPort, "search", search);
  Behavon.useExport(searchPort, "search");

  return status;
};
