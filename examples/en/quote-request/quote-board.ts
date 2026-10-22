import Behavon, { type Model, type Signal, type SnapshotRootId, type TypedModelRef } from "behavon";
import type { QuoteAnswer, QuoteRequest } from "./quote";
import { Supplier, type SupplierInput, type SupplierPort } from "./supplier";

type Offer = Extract<QuoteAnswer, { kind: "offer" }>;

export interface QuoteView {
  /** 0 until the first request. */
  readonly round: number;
  readonly item: string;
  readonly quantity: number;
  /** In the order they arrived. */
  readonly answers: readonly QuoteAnswer[];
  /** The offer with the lowest total. */
  readonly best: Offer | undefined;
}

export interface QuoteBoardPort {
  view: SnapshotRootId<QuoteView>;
  request: Signal<[item: string, quantity: number]>;
  /** Sent once per request. Suppliers are connected to it. */
  quoteRequested: Signal<[request: QuoteRequest]>;
}

const quoteBoardPort = Behavon.createPort<QuoteBoardPort>({
  view: Behavon.SnapshotType(),
  request: Behavon.SignalType(),
  quoteRequested: Behavon.SignalType(),
});

/** What the screen uses. */
export type QuoteScreenPort = Pick<QuoteBoardPort, "view" | "request">;

interface Round {
  readonly round: number;
  readonly item: string;
  readonly quantity: number;
  readonly answers: readonly QuoteAnswer[];
}

/** Sends a request to every connected supplier and collects the answers of the latest request. */
export const QuoteBoard: Model<undefined, number, QuoteBoardPort> = () => {
  const viewId = Behavon.useExport(quoteBoardPort, "view");
  const [current, setCurrent] = Behavon.useState<Round>({ round: 0, item: "", quantity: 0, answers: [] });
  const lastRound = Behavon.useMutable(0);

  const best = Behavon.useMemo(() => {
    let found: Offer | undefined;
    for (const answer of current.answers) {
      if (answer.kind === "offer" && (found === undefined || answer.total < found.total)) found = answer;
    }
    return found;
  }, [current.answers]);

  const [, publish] = Behavon.useSnapshot(viewId);
  Behavon.useEffect(() => {
    publish({ ...current, best });
  }, [best, current, publish]);

  const quoteRequestedBody = Behavon.useCallback((_request: QuoteRequest) => undefined, []);
  const quoteRequested = Behavon.useSignal(quoteBoardPort, "quoteRequested", quoteRequestedBody);
  Behavon.useExport(quoteBoardPort, "quoteRequested");

  const request = Behavon.useCallback((item: string, quantity: number) => {
    const name = item.trim();
    if (name === "" || !Number.isInteger(quantity) || quantity <= 0) return;
    const round = lastRound.get() + 1;
    lastRound.set(round);
    setCurrent({ round, item: name, quantity, answers: [] });
    // Answers may arrive after a newer request or after this Model ends, so they only go through the state setter.
    const reply = (answer: QuoteAnswer) => {
      setCurrent((previous) => previous.round === round ? { ...previous, answers: [...previous.answers, answer] } : previous);
    };
    quoteRequested(Object.freeze({ round, item: name, quantity, reply }));
  }, [lastRound, quoteRequested, setCurrent]);
  Behavon.useSignal(quoteBoardPort, "request", request);
  Behavon.useExport(quoteBoardPort, "request");

  return current.round;
};

export interface QuoteLinkInput {
  readonly board: TypedModelRef<Pick<QuoteBoardPort, "quoteRequested">>;
  readonly supplier: TypedModelRef<SupplierPort>;
}

/** Connects the board to one supplier. One link per supplier, because the number of suppliers varies. */
export const QuoteLink: Model<QuoteLinkInput, undefined> = (input) => {
  const board = Behavon.usePort(input.board);
  const supplier = Behavon.usePort(input.supplier);
  Behavon.useConnect(board.quoteRequested, supplier.quote);
  return undefined;
};

/** Creates the board, the suppliers, and a link for each. `dispose` releases them in reverse order. */
export function createQuoteRequest(suppliers: readonly SupplierInput[]) {
  const board = Behavon.createModel(QuoteBoard, undefined);
  const supplierModels = suppliers.map((supplier) => Behavon.createModel(Supplier, supplier));
  const links = supplierModels.map((supplier) => Behavon.createModel(QuoteLink, { board, supplier }));
  const screen: TypedModelRef<QuoteScreenPort> = board;
  return {
    board: screen,
    dispose() {
      for (const link of links) link.dispose();
      for (const supplier of supplierModels) supplier.dispose();
      board.dispose();
    },
  };
}
