import Behavon from "behavon";

const mutated = new Set<number>();
const snapshot = Behavon.createId(Behavon.SnapshotType<number>());

export function ReducerDiagnosticsModel(): number {
  const [, publish] = Behavon.useSnapshot(snapshot);
  const [value, dispatch] = Behavon.useReducer((state: number, action: number) => {
    mutated.add(action);
    publish(action);
    Behavon.useState(0);
    dispatch(action);
    return state + action;
  }, 0, (initial: number) => {
    mutated.add(initial);
    publish(initial);
    Behavon.useMemo(() => initial, []);
    return initial;
  });
  return value;
}
