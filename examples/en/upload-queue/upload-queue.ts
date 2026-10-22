import Behavon, { FutureCancellationError, type Model, type Signal, type SnapshotRootId } from "behavon";

/** The upload server. It should stop when `signal` aborts. */
export interface UploadApi {
  upload(name: string, signal: AbortSignal): Promise<void>;
}

export type UploadStatus = "queued" | "uploading" | "done" | "failed" | "cancelled";

export interface UploadEntry {
  readonly id: number;
  readonly name: string;
  readonly status: UploadStatus;
  readonly error: string | undefined;
}

export interface UploadView {
  readonly entries: readonly UploadEntry[];
  /** The file being uploaded now. */
  readonly current: string | undefined;
  readonly done: number;
  readonly total: number;
}

export interface UploadQueuePort {
  view: SnapshotRootId<UploadView>;
  enqueue: Signal<[names: readonly string[]]>;
  cancelCurrent: Signal;
  clearFinished: Signal;
}

const queuePort = Behavon.createPort<UploadQueuePort>({
  view: Behavon.SnapshotType(),
  enqueue: Behavon.SignalType(),
  cancelCurrent: Behavon.SignalType(),
  clearFinished: Behavon.SignalType(),
});

interface UploadJob {
  readonly id: number;
  readonly name: string;
}

/** Uploads the files one at a time, in the order they were added. */
export const UploadQueue: Model<UploadApi, number, UploadQueuePort> = (api) => {
  const viewId = Behavon.useExport(queuePort, "view");
  const [entries, setEntries] = Behavon.useState<readonly UploadEntry[]>([]);
  const nextId = Behavon.useMutable(1);

  const upload = Behavon.useFuture(
    (job: UploadJob, { signal }) => api.upload(job.name, signal),
    { concurrency: "serial" },
  );

  Behavon.useEffect(() => {
    const update = (id: number, status: UploadStatus, error?: string) =>
      setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, status, error } : entry));
    const offPending = upload.pending.subscribe(({ input }) => update(input.id, "uploading"));
    const offFulfilled = upload.fulfilled.subscribe(({ input }) => update(input.id, "done"));
    const offRejected = upload.rejected.subscribe(({ input, reason }) => {
      if (reason instanceof FutureCancellationError) update(input.id, "cancelled");
      else update(input.id, "failed", reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      offPending();
      offFulfilled();
      offRejected();
    };
  }, [setEntries, upload]);

  const view = Behavon.useMemo<UploadView>(() => ({
    entries,
    current: entries.find((entry) => entry.status === "uploading")?.name,
    done: entries.filter((entry) => entry.status === "done").length,
    total: entries.length,
  }), [entries]);
  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => publish(view), [publish, view]);

  const enqueue = Behavon.useCallback((names: readonly string[]) => {
    const jobs = names.map((name) => {
      const id = nextId.get();
      nextId.set(id + 1);
      return { id, name };
    });
    setEntries((current) => [
      ...current,
      ...jobs.map((job) => ({ ...job, status: "queued" as const, error: undefined })),
    ]);
    // Each run's Promise rejects when it fails or is cancelled; the entry status already shows that.
    for (const job of jobs) upload.start(job).catch(() => undefined);
  }, [nextId, setEntries, upload]);
  Behavon.useSignal(queuePort, "enqueue", enqueue);
  Behavon.useExport(queuePort, "enqueue");

  const cancelCurrent = Behavon.useCallback(() => upload.abort(), [upload]);
  Behavon.useSignal(queuePort, "cancelCurrent", cancelCurrent);
  Behavon.useExport(queuePort, "cancelCurrent");

  const clearFinished = Behavon.useCallback(
    () => setEntries((current) => current.filter((entry) => entry.status !== "done")),
    [setEntries],
  );
  Behavon.useSignal(queuePort, "clearFinished", clearFinished);
  Behavon.useExport(queuePort, "clearFinished");

  return entries.length;
};
