import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createFakeUploadApi } from "./fake-upload-api";
import { UploadQueue } from "./upload-queue";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("upload-queue", () => {
  it("uploads one file at a time in order", async () => {
    const server = createFakeUploadApi();
    const queue = Behavon.createModel(UploadQueue, server.api);
    const view = Behavon.getSnapshot(queue.view);
    const statuses = () => view()?.entries.map((entry) => `${entry.name}:${entry.status}`);

    queue.enqueue(["a.png", "b.png", "c.png"]);
    await settle();
    expect(server.started()).toEqual(["a.png"]);
    expect(statuses()).toEqual(["a.png:uploading", "b.png:queued", "c.png:queued"]);
    expect(view()?.current).toBe("a.png");

    server.upload("a.png").finish();
    await settle();
    expect(server.started()).toEqual(["a.png", "b.png"]);
    expect(statuses()).toEqual(["a.png:done", "b.png:uploading", "c.png:queued"]);

    server.upload("b.png").finish();
    await settle();
    server.upload("c.png").finish();
    await settle();
    expect(statuses()).toEqual(["a.png:done", "b.png:done", "c.png:done"]);
    expect(view()).toMatchObject({ current: undefined, done: 3, total: 3 });
    queue.dispose();
  });

  it("adds files to the end while another upload runs", async () => {
    const server = createFakeUploadApi();
    const queue = Behavon.createModel(UploadQueue, server.api);
    queue.enqueue(["a.png"]);
    await settle();
    queue.enqueue(["b.png"]);
    await settle();
    server.upload("a.png").finish();
    await settle();
    expect(server.started()).toEqual(["a.png", "b.png"]);
    queue.dispose();
  });

  it("cancels only the current upload and continues with the next", async () => {
    const server = createFakeUploadApi();
    const queue = Behavon.createModel(UploadQueue, server.api);
    const view = Behavon.getSnapshot(queue.view);
    queue.enqueue(["a.png", "b.png"]);
    await settle();
    queue.cancelCurrent();
    await settle();
    expect(server.upload("a.png").signal.aborted).toBe(true);
    expect(view()?.entries.map((entry) => entry.status)).toEqual(["cancelled", "uploading"]);
    queue.dispose();
  });

  it("marks a failed upload and continues with the next", async () => {
    const server = createFakeUploadApi();
    const queue = Behavon.createModel(UploadQueue, server.api);
    const view = Behavon.getSnapshot(queue.view);
    queue.enqueue(["a.png", "b.png"]);
    await settle();
    server.upload("a.png").fail("File too large");
    await settle();
    expect(view()?.entries[0]).toMatchObject({ status: "failed", error: "File too large" });
    expect(view()?.entries[1].status).toBe("uploading");
    queue.dispose();
  });

  it("clears the finished entries", async () => {
    const server = createFakeUploadApi();
    const queue = Behavon.createModel(UploadQueue, server.api);
    queue.enqueue(["a.png", "b.png"]);
    await settle();
    server.upload("a.png").finish();
    await settle();
    queue.clearFinished();
    await settle();
    expect(Behavon.getSnapshot(queue.view)()?.entries.map((entry) => entry.name)).toEqual(["b.png"]);
    queue.dispose();
  });

  it("aborts the running upload and drops the waiting ones on dispose", async () => {
    const server = createFakeUploadApi();
    const queue = Behavon.createModel(UploadQueue, server.api);
    queue.enqueue(["a.png", "b.png"]);
    await settle();
    queue.dispose();
    await settle();
    expect(server.upload("a.png").signal.aborted).toBe(true);
    expect(server.started()).toEqual(["a.png"]);
  });
});
