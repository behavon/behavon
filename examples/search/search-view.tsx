import { useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { SearchPort } from "./search";

const statusText = {
  idle: "검색어를 입력하세요",
  searching: "검색 중…",
  done: "검색 완료",
  failed: "검색 실패",
} as const;

export function SearchView({ search }: { readonly search: TypedModelRef<SearchPort> }) {
  const view = useSyncExternalStore(Behavon.subscribe(search.view), Behavon.getSnapshot(search.view));
  if (view === undefined) return null;
  return (
    <section>
      <input aria-label="검색어" value={view.query} onChange={(event) => search.search(event.target.value)} />
      <p role="status">{statusText[view.status]}</p>
      {view.error !== undefined && <p role="alert">{view.error}</p>}
      <ul aria-label="결과">
        {view.results.map((result) => <li key={result}>{result}</li>)}
      </ul>
      <ol aria-label="기록">
        {view.log.map((line, index) => <li key={index}>{line}</li>)}
      </ol>
    </section>
  );
}
