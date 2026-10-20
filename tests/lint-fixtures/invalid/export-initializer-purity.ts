import Behave from "behavon";

let externalCount = 0;

export function ExportInitializerPurity(): undefined {
  Behave.useExport(() => {
    externalCount += 1;
    return { value: externalCount };
  });
  return undefined;
}
