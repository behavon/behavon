import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createFakeSearchApi } from "./fake-search-api";
import { Search } from "./search";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("search", () => {
  it("starts idle", () => {
    const server = createFakeSearchApi();
    const search = Behavon.createModel(Search, server.api);
    expect(Behavon.getSnapshot(search.view)()).toEqual({
      query: "", status: "idle", results: [], error: undefined, log: [],
    });
    search.dispose();
  });

  it("shows the results of the latest query and cancels the earlier ones", async () => {
    const server = createFakeSearchApi();
    const search = Behavon.createModel(Search, server.api);
    const view = Behavon.getSnapshot(search.view);

    search.search("b");
    await settle();
    search.search("be");
    await settle();
    search.search("beh");
    await settle();
    expect(view()?.status).toBe("searching");
    expect(server.request("b").signal.aborted).toBe(true);
    expect(server.request("be").signal.aborted).toBe(true);
    expect(server.request("beh").signal.aborted).toBe(false);

    server.request("beh").respond(["behavon", "behavior"]);
    await settle();
    expect(view()).toMatchObject({ query: "beh", status: "done", results: ["behavon", "behavior"] });
    expect(view()?.log).toEqual([
      "시작: b",
      "취소: b",
      "시작: be",
      "취소: be",
      "시작: beh",
      "완료: beh (2건)",
    ]);
    search.dispose();
  });

  it("keeps the previous results on screen while the next search runs", async () => {
    const server = createFakeSearchApi();
    const search = Behavon.createModel(Search, server.api);
    const view = Behavon.getSnapshot(search.view);
    search.search("a");
    await settle();
    server.request("a").respond(["apple"]);
    await settle();
    search.search("ab");
    await settle();
    expect(view()).toMatchObject({ status: "searching", results: ["apple"] });
    search.dispose();
  });

  it("clears the screen and cancels the search when the query is emptied", async () => {
    const server = createFakeSearchApi();
    const search = Behavon.createModel(Search, server.api);
    const view = Behavon.getSnapshot(search.view);
    search.search("a");
    await settle();
    search.search("");
    await settle();
    expect(server.request("a").signal.aborted).toBe(true);
    expect(view()).toMatchObject({ query: "", status: "idle", results: [] });
    expect(view()?.log).toEqual(["시작: a", "취소: a"]);
    search.dispose();
  });

  it("shows the error when the server fails", async () => {
    const server = createFakeSearchApi();
    const search = Behavon.createModel(Search, server.api);
    const view = Behavon.getSnapshot(search.view);
    search.search("x");
    await settle();
    server.request("x").fail("서버 오류");
    await settle();
    expect(view()).toMatchObject({ status: "failed", error: "서버 오류" });
    expect(view()?.log.at(-1)).toBe("실패: x (서버 오류)");
    search.dispose();
  });

  it("aborts the running request on dispose", async () => {
    const server = createFakeSearchApi();
    const search = Behavon.createModel(Search, server.api);
    search.search("a");
    await settle();
    search.dispose();
    expect(server.request("a").signal.aborted).toBe(true);
  });
});
