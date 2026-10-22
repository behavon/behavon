// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import Behavon from "behavon";
import { createFakeUploadApi } from "./fake-upload-api";
import { UploadQueue } from "./upload-queue";
import { UploadQueueView } from "./upload-queue-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("UploadQueueView", () => {
  it("adds files and shows their progress", async () => {
    const server = createFakeUploadApi();
    const queue = Behavon.createModel(UploadQueue, server.api);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<UploadQueueView queue={queue} />));

    const run = async (action: () => void) => {
      await act(async () => {
        action();
        await settle();
      });
    };
    const field = container.querySelector("input") as HTMLInputElement;
    await run(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, "a.png, b.png");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await run(() => (container.querySelector("button[type='submit']") as HTMLButtonElement).click());
    expect(container.querySelector("[role='status']")?.textContent).toBe("0/2 done · uploading a.png");

    await run(() => server.upload("a.png").finish());
    expect([...container.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "a.png: Done",
      "b.png: Uploading",
    ]);

    await act(async () => root.unmount());
    container.remove();
    queue.dispose();
  });
});
