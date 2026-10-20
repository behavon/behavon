import Behave from "behavon";

function invokeFutureStart(start: (input: number) => Promise<number>): void {
  void start(4);
}

export function InvalidFutureModel(): undefined {
  const future = Behave.useFuture(async (input: number) => input, { concurrency: "serial" });
  future.start(1);
  future.abort("stop");
  future.start.call(undefined, 2);
  future.abort.apply(undefined, ["stop"]);
  const start = future.start;
  start(3);
  invokeFutureStart(future.start);
  (0, future.start)(5);
  Reflect.apply(future.start, undefined, [6]);
  const boundStart = future.start.bind(future);
  boundStart(7);
  future.snapshot();
  return undefined;
}
