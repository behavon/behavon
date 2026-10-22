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
    expect(container.querySelector("[aria-label='연결']")?.textContent).toBe("연결됨");

    await run(() => button("조회").click());
    expect(container.querySelector("[role='status']")?.textContent).toBe("조회 중…");
    await run(() => database.latestQuery().answer([{ id: 1, customer: "김", total: 32000 }]));
    expect(container.querySelector("tbody")?.textContent).toBe("김32000");

    await run(() => button("조회").click());
    await run(() => button("취소").click());
    expect(container.querySelector("[role='status']")?.textContent).toBe("조회 취소됨");
    expect(button("다시 연결")).toBeDefined();

    await act(async () => root.unmount());
    container.remove();
    report.dispose();
  });
});
