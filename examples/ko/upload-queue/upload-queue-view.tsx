import { useState, useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { UploadQueuePort, UploadStatus } from "./upload-queue";

const statusText: Record<UploadStatus, string> = {
  queued: "대기",
  uploading: "업로드 중",
  done: "완료",
  failed: "실패",
  cancelled: "취소",
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
        <input aria-label="파일 이름(쉼표로 구분)" value={names} onChange={(event) => setNames(event.target.value)} />
        <button type="submit">올리기</button>
      </form>
      <p role="status">
        {view.done}/{view.total} 완료{view.current === undefined ? "" : ` · ${view.current} 업로드 중`}
      </p>
      <button type="button" disabled={view.current === undefined} onClick={() => queue.cancelCurrent()}>지금 올리는 파일 취소</button>
      <button type="button" disabled={view.done === 0} onClick={() => queue.clearFinished()}>완료 항목 지우기</button>
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
