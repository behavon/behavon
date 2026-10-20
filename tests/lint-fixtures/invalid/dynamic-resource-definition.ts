import Behave from "behavon";

export function makeResource() {
  return Behave.createResource({
    open: () => ({}),
    close: () => undefined,
    abort: () => undefined,
  });
}
