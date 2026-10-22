import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { DemoCase, DemoInstance } from "./cases";

/**
 * Shows one case at a time in one React root.
 * When switching, the next screen is rendered first; the previous Models are released
 * only after their screen is gone, so no component reads a released Model.
 */
export function createDemoHost(container: Element, cases: readonly DemoCase[]) {
  const root = createRoot(container);
  let current: DemoInstance | undefined;
  let shown = 0;
  return {
    show(id: string): DemoCase {
      const selected = cases.find((item) => item.id === id) ?? cases[0];
      if (selected === undefined) throw new Error("no demo cases");
      const next = selected.create();
      const previous = current;
      // A new key every time, so even the same case gets a fresh screen for its fresh Models.
      shown += 1;
      flushSync(() => root.render(<section key={shown}>{next.element}</section>));
      current = next;
      previous?.dispose();
      return selected;
    },
    dispose() {
      root.unmount();
      current?.dispose();
      current = undefined;
    },
  };
}
