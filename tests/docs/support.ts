import { inspectModelInstanceForTests } from "../../src/internal/model-inspection";

/** The latest committed output of a Model instance, as another Model would read it with useModel. */
export function outputOf(instance: object): unknown {
  return inspectModelInstanceForTests(instance).output;
}

/** Waits for scheduled Model re-evaluations, which run in a microtask. */
export function settle(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
