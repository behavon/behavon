// @vitest-environment jsdom
// Documentation examples that render React or read browser globals.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import Behavon from "behavon";
import { outputOf, settle } from "./support";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

async function render(element: React.ReactElement): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(element));
  return container;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("docs/getting-started.md (React)", () => {
  it("renders the count and increments on click", async () => {
    const { CounterButton, counter } = await import("./.generated/getting-started-2");
    const view = await render(<CounterButton />);
    const button = view.querySelector("button");
    expect(button?.textContent).toBe("0");
    await act(async () => {
      button?.click();
      await settle();
    });
    expect(button?.textContent).toBe("1");
    await act(async () => root?.unmount());
    root = undefined;
    counter.dispose();
  });
});

describe("docs/api/subscribe.md", () => {
  it("renders the published temperature", async () => {
    const { TemperatureView, thermometer } = await import("./.generated/api-subscribe-1");
    const view = await render(<TemperatureView />);
    expect(view.textContent).toBe("21°C");
    await act(async () => root?.unmount());
    root = undefined;
    thermometer.dispose();
  });
});

describe("docs/api/TypedModelRef.md", () => {
  it("increments through the narrowed ref", async () => {
    const { button, counter } = await import("./.generated/api-TypedModelRef-1");
    const view = await render(button);
    await act(async () => {
      view.querySelector("button")?.click();
      await settle();
    });
    expect(Behavon.getSnapshot(counter.count)()).toBe(1);
    await act(async () => root?.unmount());
    root = undefined;
    counter.dispose();
  });
});

describe("docs/api/useSyncExternalStore.md", () => {
  it("follows navigator.onLine through online/offline events", async () => {
    const { networkStatus } = await import("./.generated/api-useSyncExternalStore-1");
    expect(outputOf(networkStatus)).toBe(navigator.onLine);
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
    await settle();
    expect(outputOf(networkStatus)).toBe(false);
    networkStatus.dispose();
  });
});
