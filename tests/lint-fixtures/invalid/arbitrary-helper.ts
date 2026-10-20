import Behave from "behavon";

function readStateFromArbitraryHelper(): number {
  return Behave.useState(0)[0];
}

export function HelperCallerModel(): number {
  return readStateFromArbitraryHelper();
}
