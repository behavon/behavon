import Behavon, { createResource } from "behavon";

const extracted = Behavon.createResource;
const { createResource: destructured } = Behavon;
void extracted;
void destructured;

export function InvalidNestedResourceFactory() {
  return createResource({
    open: () => ({}),
    close: () => undefined,
    abort: () => undefined,
  });
}
