import Behavon from "behavon";

export function makeResource() {
  return Behavon.createResource({
    open: () => ({}),
    close: () => undefined,
    abort: () => undefined,
  });
}
