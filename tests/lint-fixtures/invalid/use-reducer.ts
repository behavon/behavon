import Behave from "behavon";

const mutated = new Set<number>();
const snapshot = Behave.createId(Behave.SnapshotType<number>());

export function ReducerDiagnosticsModel(): number {
  const [, publish] = Behave.useSnapshot(snapshot);
  const [value, dispatch] = Behave.useReducer((state: number, action: number) => {
    mutated.add(action);
    publish(action);
    Behave.useState(0);
    dispatch(action);
    return state + action;
  }, 0, (initial: number) => {
    mutated.add(initial);
    publish(initial);
    Behave.useMemo(() => initial, []);
    return initial;
  });
  return value;
}
