import Behavon from "behavon";

export function FutureModel(): undefined {
  const future = Behavon.useFuture(async (input: number, { signal }) => {
    signal.throwIfAborted();
    return input;
  }, { concurrency: "serial" });
  const snapshot = future.snapshot();
  const run = Behavon.useCallback(() => future.start(1), [future]);
  const boundStart = future.start.bind(future);
  Behavon.useEffect(() => { void run(); }, [run]);
  Behavon.useEffect(() => { void boundStart(2); }, [boundStart]);
  void snapshot;
  return undefined;
}
