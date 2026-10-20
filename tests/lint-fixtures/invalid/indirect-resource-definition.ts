import Behave, { createResource } from "behavon";

const extracted = Behave.createResource;
const { createResource: destructured } = Behave;
void extracted;
void destructured;

export function InvalidNestedResourceFactory() {
  return createResource({
    open: () => ({}),
    close: () => undefined,
    abort: () => undefined,
  });
}
