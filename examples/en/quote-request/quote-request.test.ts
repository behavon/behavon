import { describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import { createFakePriceSource } from "./fake-price-source";
import { createQuoteRequest } from "./quote-board";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function openBoard() {
  const sources = { Ganada: createFakePriceSource(), Dara: createFakePriceSource(), Maba: createFakePriceSource() };
  const { board, dispose } = createQuoteRequest(
    Object.entries(sources).map(([name, source]) => ({ name, priceOf: source.priceOf })),
  );
  return { sources, board, dispose, view: Behavon.getSnapshot(board.view) };
}

describe("quote-request", () => {
  it("sends one request to every supplier and keeps the answers in arrival order", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("bolt", 100);
    for (const source of Object.values(sources)) {
      expect(source.requests.map(({ item, quantity }) => [item, quantity])).toEqual([["bolt", 100]]);
    }

    sources.Maba.latest().answer(12);
    await settle();
    sources.Ganada.latest().answer(10);
    await settle();
    expect(view()?.answers.map((answer) => answer.supplier)).toEqual(["Maba", "Ganada"]);

    sources.Dara.latest().answer(11);
    await settle();
    expect(view()).toMatchObject({ round: 1, item: "bolt", quantity: 100 });
    expect(view()?.answers.map((answer) => answer.supplier)).toEqual(["Maba", "Ganada", "Dara"]);
    dispose();
  });

  it("picks the lowest total among the offers", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("nut", 10);
    sources.Ganada.latest().answer(undefined);
    sources.Dara.latest().fail("Price list under maintenance");
    sources.Maba.latest().answer(7);
    await settle();
    expect(view()?.answers).toEqual([
      { kind: "declined", supplier: "Ganada" },
      { kind: "failed", supplier: "Dara", message: "Price list under maintenance" },
      { kind: "offer", supplier: "Maba", unitPrice: 7, total: 70 },
    ]);
    expect(view()?.best).toEqual({ kind: "offer", supplier: "Maba", unitPrice: 7, total: 70 });
    dispose();
  });

  it("starts over on a new request and ignores late answers to the previous one", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("bolt", 100);
    const late = sources.Ganada.latest();
    sources.Dara.latest().answer(11);
    await settle();
    expect(view()?.answers).toHaveLength(1);

    board.request("washer", 50);
    await settle();
    expect(view()).toMatchObject({ round: 2, item: "washer", answers: [], best: undefined });

    late.answer(1);
    sources.Maba.latest().answer(3);
    await settle();
    expect(view()?.answers).toEqual([{ kind: "offer", supplier: "Maba", unitPrice: 3, total: 150 }]);
    dispose();
  });

  it("keeps both requests apart when they are sent in the same tick", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("bolt", 100);
    board.request("washer", 50);
    for (const source of Object.values(sources)) {
      expect(source.requests.map(({ item }) => item)).toEqual(["bolt", "washer"]);
      source.requests[0].answer(1);
    }
    sources.Ganada.latest().answer(2);
    await settle();
    expect(view()).toMatchObject({ round: 2, item: "washer" });
    expect(view()?.answers).toEqual([{ kind: "offer", supplier: "Ganada", unitPrice: 2, total: 100 }]);
    dispose();
  });

  it("ignores an empty item or a quantity that is not a positive whole number", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("  ", 1);
    board.request("bolt", 0);
    board.request("bolt", 1.5);
    await settle();
    expect(sources.Ganada.requests).toHaveLength(0);
    expect(view()?.round).toBe(0);
    dispose();
  });

  it("does nothing when an answer arrives after dispose", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sources, board, dispose } = openBoard();
    board.request("bolt", 100);
    await settle();
    dispose();
    sources.Ganada.latest().answer(10);
    sources.Dara.latest().fail("Late failure");
    await settle();
    expect(errors).not.toHaveBeenCalled();
  });
});
