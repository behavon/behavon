import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createFakeDatabase } from "./fake-database";
import { OrdersReport, ordersQuery } from "./orders-report";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const url = "postgres://shop";

async function openReport(options: { readonly ignoresAbort?: boolean } = {}) {
  const database = createFakeDatabase(options);
  const report = Behavon.createModel(OrdersReport, { url, driver: database.driver });
  database.accept();
  await settle();
  return { database, report, view: Behavon.getSnapshot(report.view) };
}

describe("orders report", () => {
  it("connects when created", async () => {
    const database = createFakeDatabase();
    const report = Behavon.createModel(OrdersReport, { url, driver: database.driver });
    await settle();
    expect(Behavon.getSnapshot(report.view)()?.connection).toBe("opening");
    database.accept();
    await settle();
    expect(Behavon.getSnapshot(report.view)()?.connection).toBe("open");
    expect(database.events).toEqual([`connect ${url}`]);
    report.dispose();
  });

  it("runs the query and shows the rows", async () => {
    const { database, report, view } = await openReport();
    report.run(10000);
    await settle();
    expect(view()?.status).toBe("running");
    expect(database.latestQuery()).toMatchObject({ sql: ordersQuery, params: [10000] });
    database.latestQuery().answer([{ id: 1, customer: "김", total: 32000 }]);
    await settle();
    expect(view()).toMatchObject({ status: "done", rows: [{ id: 1, customer: "김", total: 32000 }] });
    report.dispose();
  });

  it("ignores a second run while one is running", async () => {
    const { database, report } = await openReport();
    report.run(1);
    report.run(2);
    await settle();
    expect(database.queryCount()).toBe(1);
    report.dispose();
  });

  it("shows the error of a failed query", async () => {
    const { database, report, view } = await openReport();
    report.run(1);
    await settle();
    database.latestQuery().fail("timeout");
    await settle();
    expect(view()).toMatchObject({ status: "failed", error: "timeout" });
    report.dispose();
  });

  it("cancels by aborting the session", async () => {
    const { database, report, view } = await openReport();
    report.run(1);
    await settle();
    const query = database.latestQuery();
    report.cancel();
    await settle();
    expect(query.signal.aborted).toBe(true);
    expect(database.events).toContain("destroy");
    expect(view()).toMatchObject({ connection: "closed", status: "cancelled", rows: [] });

    report.connect();
    database.accept();
    await settle();
    report.run(2);
    await settle();
    database.latestQuery().answer([{ id: 2, customer: "이", total: 7 }]);
    await settle();
    expect(view()).toMatchObject({ connection: "open", status: "done" });
    report.dispose();
  });

  it("does not show the late result of a driver that ignores the cancel", async () => {
    const { database, report, view } = await openReport({ ignoresAbort: true });
    report.run(1);
    await settle();
    const late = database.latestQuery();
    report.cancel();
    await settle();
    expect(view()?.status).toBe("cancelled");

    report.connect();
    database.accept();
    await settle();
    report.run(2);
    await settle();
    late.answer([{ id: 9, customer: "늦은 결과", total: 1 }]);
    await settle();
    expect(view()).toMatchObject({ status: "running", rows: [] });
    database.latestQuery().answer([{ id: 2, customer: "이", total: 7 }]);
    await settle();
    expect(view()?.rows).toEqual([{ id: 2, customer: "이", total: 7 }]);
    report.dispose();
  });

  it("closes after the running query finishes", async () => {
    const { database, report, view } = await openReport();
    report.run(1);
    await settle();
    report.close();
    await settle();
    expect(view()?.connection).toBe("closing");
    expect(database.events).not.toContain("close");
    database.latestQuery().answer([{ id: 1, customer: "김", total: 5 }]);
    await settle();
    expect(view()).toMatchObject({ connection: "closed", status: "done" });
    expect(database.events).toContain("close");
    report.dispose();
  });

  it("destroys the connection on dispose", async () => {
    const { database, report } = await openReport();
    report.dispose();
    await settle();
    expect(database.events).toContain("destroy");
  });
});
