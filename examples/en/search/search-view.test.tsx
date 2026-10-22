// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createFakeSearchApi } from "./fake-search-api";
import { Search } from "./search";
import { SearchView } from "./search-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("SearchView", () => {
  it("searches while typing and shows the latest results", async () => {
    const server = createFakeSearchApi();
    const search = Behavon.createModel(Search, server.api);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<SearchView search={search} />));

    const field = container.querySelector("input") as HTMLInputElement;
    const run = async (action: () => void) => {
      await act(async () => {
        action();
        await settle();
      });
    };
    const type = (value: string) => run(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector("[role='status']")?.textContent).toBe("Type a search term");
    await type("b");
    await type("be");
    expect(container.querySelector("[role='status']")?.textContent).toBe("Searching…");
    await run(() => server.request("be").respond(["behavon"]));
    expect(container.querySelector("[role='status']")?.textContent).toBe("Search done");
    expect([...container.querySelectorAll("[aria-label='Results'] li")].map((item) => item.textContent)).toEqual(["behavon"]);

    await act(async () => root.unmount());
    container.remove();
    search.dispose();
  });
});
