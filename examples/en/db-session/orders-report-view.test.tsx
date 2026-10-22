// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createFakeDatabase } from "./fake-database";
import { OrdersReport } from "./orders-report";
import { OrdersReportView } from "./orders-report-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("OrdersReportView", () => {
  it("runs the query from the form and cancels it", async () => {
    const database = createFakeDatabase();
    const report = Behavon.createModel(OrdersReport, { url: "postgres://shop", driver: database.driver });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<OrdersReportView report={report} />));

    const run = async (action: () => void) => {
      await act(async () => {
        action();
        await settle();
      });
    };
    const button = (label: string) =>
      [...container.querySelectorAll("button")].find((item) => item.textContent === label) as HTMLButtonElement;

    await run(() => database.accept());
    expect(container.querySelector("[aria-label='Connection']")?.textContent).toBe("Connected");

    await run(() => button("Run query").click());
    expect(container.querySelector("[role='status']")?.textContent).toBe("Querying…");
    await run(() => database.latestQuery().answer([{ id: 1, customer: "Kim", total: 32000 }]));
    expect(container.querySelector("tbody")?.textContent).toBe("Kim32000");

    await run(() => button("Run query").click());
    await run(() => button("Cancel").click());
    expect(container.querySelector("[role='status']")?.textContent).toBe("Query cancelled");
    expect(button("Reconnect")).toBeDefined();

    await act(async () => root.unmount());
    container.remove();
    report.dispose();
  });
});
