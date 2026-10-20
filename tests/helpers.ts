import Behave, { type SnapshotId, type SnapshotRootId } from "behavon";

let sequence = 0;

export function uniqueChannel<T = any>(_prefix: string): SnapshotRootId<T> {
  sequence += 1;
  return Behave.createId(Behave.SnapshotType<T>());
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

export async function waitForSnapshot<T>(
  channel: SnapshotId<T>,
  predicate: (snapshot: T | undefined) => boolean,
): Promise<T | undefined> {
  const read = Behave.getSnapshot(channel);
  await waitFor(() => predicate(read()), "snapshot did not reach the expected value");
  return read();
}
