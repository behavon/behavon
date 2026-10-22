import { useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { SearchPort } from "./search";

const statusText = {
  idle: "Type a search term",
  searching: "Searching…",
  done: "Search done",
  failed: "Search failed",
} as const;

export function SearchView({ search }: { readonly search: TypedModelRef<SearchPort> }) {
  const view = useSyncExternalStore(Behavon.subscribe(search.view), Behavon.getSnapshot(search.view));
  if (view === undefined) return null;
  return (
    <section>
      <input aria-label="Search term" value={view.query} onChange={(event) => search.search(event.target.value)} />
      <p role="status">{statusText[view.status]}</p>
      {view.error !== undefined && <p role="alert">{view.error}</p>}
      <ul aria-label="Results">
        {view.results.map((result) => <li key={result}>{result}</li>)}
      </ul>
      <ol aria-label="Log">
        {view.log.map((line, index) => <li key={index}>{line}</li>)}
      </ol>
    </section>
  );
}
