import { useState, useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { QuoteAnswer } from "./quote";
import type { QuoteScreenPort } from "./quote-board";

function describe(answer: QuoteAnswer): string {
  switch (answer.kind) {
    case "offer": return `${answer.supplier}: ${answer.unitPrice} each, ${answer.total} in total`;
    case "declined": return `${answer.supplier}: Not available`;
    case "failed": return `${answer.supplier}: Error (${answer.message})`;
  }
}

export function QuoteView({ board }: { readonly board: TypedModelRef<QuoteScreenPort> }) {
  const view = useSyncExternalStore(Behavon.subscribe(board.view), Behavon.getSnapshot(board.view));
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState(1);
  if (view === undefined) return null;
  return (
    <section>
      <form onSubmit={(event) => { event.preventDefault(); board.request(item, quantity); }}>
        <input aria-label="Item" value={item} onChange={(event) => setItem(event.target.value)} />
        <input aria-label="Quantity" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
        <button type="submit" disabled={item.trim() === ""}>Request quotes</button>
      </form>
      {view.round > 0 && <p role="status">{view.item} × {view.quantity}: {view.answers.length} answers</p>}
      <ol aria-label="Answers">
        {view.answers.map((answer) => <li key={answer.supplier}>{describe(answer)}</li>)}
      </ol>
      {view.best !== undefined && <p aria-label="Lowest price">Lowest: {view.best.supplier} {view.best.total}</p>}
    </section>
  );
}
