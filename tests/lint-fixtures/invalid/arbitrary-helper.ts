import Behavon from "behavon";

function readStateFromArbitraryHelper(): number {
  return Behavon.useState(0)[0];
}

export function HelperCallerModel(): number {
  return readStateFromArbitraryHelper();
}
