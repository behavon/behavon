import Behavon, { type SnapshotRootId } from "behavon";
const port = Behavon.createPort<{ view: SnapshotRootId<number> }>({ view: Behavon.SnapshotType() });
export function ExportResultMutation(): undefined {
  const exported = Behavon.useExport(port, "view");
  // @ts-expect-error Invalid authoring probe mutates a readonly Hook result.
  exported.value = 2;
  return undefined;
}
