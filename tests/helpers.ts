import Behavon, { type Signal, type SnapshotId, type SnapshotRootId } from "behavon";
import { inspectModelInstanceForTests } from "../src/internal/model-inspection";

let sequence = 0;

export function uniqueChannel<T = any>(_prefix: string): SnapshotRootId<T> {
  sequence += 1;
  return Behavon.createId(Behavon.SnapshotType<T>());
}

export async function waitFor(
  assertion: () => boolean,
  message = "observable state did not become quiescent",
  attempts = 100,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (assertion()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(message);
}

/**
 * The Signal handle a Model received from useSignal. Tests use it to drive dispatch semantics
 * of Signals that are not exported, without going through the public ref.
 */
export function signalOf(target: object, name: string): Signal<any[]> {
  const handle = inspectModelInstanceForTests(target).endpointCache.get(`signal:${name}`);
  if (typeof handle !== "function") throw new Error(`test helper: no Signal handle '${name}'`);
  return handle as Signal<any[]>;
}

export async function waitForSnapshot<T>(
  channel: SnapshotId<T>,
  predicate: (snapshot: T | undefined) => boolean,
): Promise<T | undefined> {
  const read = Behavon.getSnapshot(channel);
  await waitFor(() => predicate(read()), "snapshot did not reach the expected value");
  return read();
}
