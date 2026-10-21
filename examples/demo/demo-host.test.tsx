// @vitest-environment jsdom
import { act, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { demoCases, type DemoCase } from "./cases";
import { createDemoHost } from "./demo-host";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function Screen({ name, log }: { readonly name: string; readonly log: string[] }) {
  useEffect(() => () => {
    log.push(`unmount ${name}`);
  }, [log, name]);
  return <p>{name}</p>;
}

function recordingCase(id: string, log: string[]): DemoCase {
  return {
    id,
    label: id,
    create() {
      log.push(`create ${id}`);
      return { element: <Screen name={id} log={log} />, dispose: () => log.push(`dispose ${id}`) };
    },
  };
}

describe("demo host", () => {
  it("removes the previous screen before releasing its Models", async () => {
    const log: string[] = [];
    const container = document.createElement("div");
    const host = createDemoHost(container, [recordingCase("a", log), recordingCase("b", log)]);
    await act(async () => host.show("a"));
    await act(async () => host.show("b"));
    expect(container.textContent).toBe("b");
    await act(async () => host.dispose());
    expect(log).toEqual(["create a", "create b", "unmount a", "dispose a", "unmount b", "dispose b"]);
  });

  it("starts the same case again with fresh Models and a fresh screen", async () => {
    const log: string[] = [];
    const host = createDemoHost(document.createElement("div"), [recordingCase("a", log)]);
    await act(async () => host.show("a"));
    await act(async () => host.show("a"));
    await act(async () => host.dispose());
    expect(log).toEqual(["create a", "create a", "unmount a", "dispose a", "unmount a", "dispose a"]);
  });

  it("falls back to the first case for an unknown id", async () => {
    const log: string[] = [];
    const host = createDemoHost(document.createElement("div"), [recordingCase("a", log)]);
    let shown: DemoCase | undefined;
    await act(async () => {
      shown = host.show("nowhere");
    });
    expect(shown?.id).toBe("a");
    await act(async () => host.dispose());
  });

  it("shows and releases every case without errors", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const container = document.createElement("div");
    document.body.append(container);
    const host = createDemoHost(container, demoCases);
    for (const item of demoCases) {
      await act(async () => {
        host.show(item.id);
        await settle();
      });
      expect(container.textContent, item.id).not.toBe("");
    }
    await act(async () => host.dispose());
    container.remove();
    expect(errors).not.toHaveBeenCalled();
  });
});
