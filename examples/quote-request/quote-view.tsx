import { useState, useSyncExternalStore } from "react";
import Behavon, { type TypedModelRef } from "behavon";
import type { QuoteAnswer } from "./quote";
import type { QuoteScreenPort } from "./quote-board";

function describe(answer: QuoteAnswer): string {
  switch (answer.kind) {
    case "offer": return `${answer.supplier}: 개당 ${answer.unitPrice}원, 합계 ${answer.total}원`;
    case "declined": return `${answer.supplier}: 공급 불가`;
    case "failed": return `${answer.supplier}: 오류 (${answer.message})`;
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
        <input aria-label="품목" value={item} onChange={(event) => setItem(event.target.value)} />
        <input aria-label="수량" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
        <button type="submit" disabled={item.trim() === ""}>견적 요청</button>
      </form>
      {view.round > 0 && <p role="status">{view.item} {view.quantity}개: 응답 {view.answers.length}개</p>}
      <ol aria-label="응답">
        {view.answers.map((answer) => <li key={answer.supplier}>{describe(answer)}</li>)}
      </ol>
      {view.best !== undefined && <p aria-label="최저가">최저가 {view.best.supplier} {view.best.total}원</p>}
    </section>
  );
}
