import { describe, expect, it, vi } from "vitest";
import Behavon from "behavon";
import { createFakePriceSource } from "./fake-price-source";
import { createQuoteRequest } from "./quote-board";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function openBoard() {
  const sources = { 가나상사: createFakePriceSource(), 다라유통: createFakePriceSource(), 마바물산: createFakePriceSource() };
  const { board, dispose } = createQuoteRequest(
    Object.entries(sources).map(([name, source]) => ({ name, priceOf: source.priceOf })),
  );
  return { sources, board, dispose, view: Behavon.getSnapshot(board.view) };
}

describe("quote-request", () => {
  it("sends one request to every supplier and keeps the answers in arrival order", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("볼트", 100);
    for (const source of Object.values(sources)) {
      expect(source.requests.map(({ item, quantity }) => [item, quantity])).toEqual([["볼트", 100]]);
    }

    sources.마바물산.latest().answer(12);
    await settle();
    sources.가나상사.latest().answer(10);
    await settle();
    expect(view()?.answers.map((answer) => answer.supplier)).toEqual(["마바물산", "가나상사"]);

    sources.다라유통.latest().answer(11);
    await settle();
    expect(view()).toMatchObject({ round: 1, item: "볼트", quantity: 100 });
    expect(view()?.answers.map((answer) => answer.supplier)).toEqual(["마바물산", "가나상사", "다라유통"]);
    dispose();
  });

  it("picks the lowest total among the offers", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("너트", 10);
    sources.가나상사.latest().answer(undefined);
    sources.다라유통.latest().fail("가격표 점검 중");
    sources.마바물산.latest().answer(7);
    await settle();
    expect(view()?.answers).toEqual([
      { kind: "declined", supplier: "가나상사" },
      { kind: "failed", supplier: "다라유통", message: "가격표 점검 중" },
      { kind: "offer", supplier: "마바물산", unitPrice: 7, total: 70 },
    ]);
    expect(view()?.best).toEqual({ kind: "offer", supplier: "마바물산", unitPrice: 7, total: 70 });
    dispose();
  });

  it("starts over on a new request and ignores late answers to the previous one", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("볼트", 100);
    const late = sources.가나상사.latest();
    sources.다라유통.latest().answer(11);
    await settle();
    expect(view()?.answers).toHaveLength(1);

    board.request("와셔", 50);
    await settle();
    expect(view()).toMatchObject({ round: 2, item: "와셔", answers: [], best: undefined });

    late.answer(1);
    sources.마바물산.latest().answer(3);
    await settle();
    expect(view()?.answers).toEqual([{ kind: "offer", supplier: "마바물산", unitPrice: 3, total: 150 }]);
    dispose();
  });

  it("keeps both requests apart when they are sent in the same tick", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("볼트", 100);
    board.request("와셔", 50);
    for (const source of Object.values(sources)) {
      expect(source.requests.map(({ item }) => item)).toEqual(["볼트", "와셔"]);
      source.requests[0].answer(1);
    }
    sources.가나상사.latest().answer(2);
    await settle();
    expect(view()).toMatchObject({ round: 2, item: "와셔" });
    expect(view()?.answers).toEqual([{ kind: "offer", supplier: "가나상사", unitPrice: 2, total: 100 }]);
    dispose();
  });

  it("ignores an empty item or a quantity that is not a positive whole number", async () => {
    const { sources, board, dispose, view } = openBoard();
    board.request("  ", 1);
    board.request("볼트", 0);
    board.request("볼트", 1.5);
    await settle();
    expect(sources.가나상사.requests).toHaveLength(0);
    expect(view()?.round).toBe(0);
    dispose();
  });

  it("does nothing when an answer arrives after dispose", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sources, board, dispose } = openBoard();
    board.request("볼트", 100);
    await settle();
    dispose();
    sources.가나상사.latest().answer(10);
    sources.다라유통.latest().fail("늦은 실패");
    await settle();
    expect(errors).not.toHaveBeenCalled();
  });
});
