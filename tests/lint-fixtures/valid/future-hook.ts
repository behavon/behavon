import Behave from "behavon";

export function FutureModel(): undefined {
  const future = Behave.useFuture(async (input: number, { signal }) => {
    signal.throwIfAborted();
    return input;
  }, { concurrency: "serial" });
  const snapshot = future.snapshot();
  const run = Behave.useCallback(() => future.start(1), [future]);
  const boundStart = future.start.bind(future);
  Behave.useEffect(() => { void run(); }, [run]);
  Behave.useEffect(() => { void boundStart(2); }, [boundStart]);
  void snapshot;
  return undefined;
}
