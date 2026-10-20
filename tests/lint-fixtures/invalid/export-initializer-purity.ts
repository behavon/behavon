import Behavon from "behavon";

let externalCount = 0;

export function ExportInitializerPurity(): undefined {
  Behavon.useExport(() => {
    externalCount += 1;
    return { value: externalCount };
  });
  return undefined;
}
