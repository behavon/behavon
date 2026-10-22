import { useState, useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { UploadQueuePort, UploadStatus } from "./upload-queue";

const statusText: Record<UploadStatus, string> = {
  queued: "Queued",
  uploading: "Uploading",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function UploadQueueView({ queue }: { readonly queue: TypedModelRef<UploadQueuePort> }) {
  const view = useSyncExternalStore(Behavon.subscribe(queue.view), Behavon.getSnapshot(queue.view));
  const [names, setNames] = useState("");
  if (view === undefined) return null;
  const submit = () => {
    const list = names.split(",").map((name) => name.trim()).filter((name) => name !== "");
    if (list.length > 0) queue.enqueue(list);
    setNames("");
  };
  return (
    <section>
      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <input aria-label="File names (comma-separated)" value={names} onChange={(event) => setNames(event.target.value)} />
        <button type="submit">Upload</button>
      </form>
      <p role="status">
        {view.done}/{view.total} done{view.current === undefined ? "" : ` · uploading ${view.current}`}
      </p>
      <button type="button" disabled={view.current === undefined} onClick={() => queue.cancelCurrent()}>Cancel current upload</button>
      <button type="button" disabled={view.done === 0} onClick={() => queue.clearFinished()}>Clear finished</button>
      <ul>
        {view.entries.map((entry) => (
          <li key={entry.id}>
            {entry.name}: {statusText[entry.status]}{entry.error === undefined ? "" : ` (${entry.error})`}
          </li>
        ))}
      </ul>
    </section>
  );
}
