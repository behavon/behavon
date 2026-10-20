import Behavon from "behavon";

export function ExportResultMutation(): undefined {
  const exported = Behavon.useExport(() => ({ value: 1 }));
  // @ts-expect-error Invalid authoring probe mutates a readonly Hook result.
  exported.value = 2;
  return undefined;
}
