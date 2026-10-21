import Behavon from "behavon";
import type { ModelInstance } from "behavon";

const moduleLabel = "stable";
const dependencySnapshot = Behavon.createId(Behavon.SnapshotType<string>());

interface Input {
  readonly step: number;
  readonly user: { readonly id: string };
  readonly instance: ModelInstance<number, string>;
}

function useCustomCommand(): () => void {
  return () => undefined;
}

export function DependencyCompletenessModel(input: Input): undefined {
  const [count, setCount] = Behavon.useState(0);
  const [output, setInput] = Behavon.useModel(input.instance);
  const [snapshot, publish] = Behavon.useSnapshot(dependencySnapshot);
  const mutable = Behavon.useMutable(0);
  const customCommand = useCustomCommand();
  const signalBody = Behavon.useCallback(() => undefined, []);
  const signal = Behavon.useSignal(dependencyCompletenessModelPort, "signal", signalBody);
  const slotBody = Behavon.useCallback(() => undefined, []);
  const slot = Behavon.useSlot(dependencyCompletenessModelPort, "slot", slotBody);
  const { step } = input;
  const user = input.user;

  const update = Behavon.useCallback(() => {
    setCount((current) => current + step);
    setInput((current) => current + step);
    publish(`${moduleLabel}:${output}:${snapshot}:${user.id}`);
    mutable.set(current => current + 1);
    signal();
    slot();
    customCommand();
  }, [customCommand, output, snapshot, step, user.id]);
  Behavon.useSignal(dependencyCompletenessModelPort, "update", update);

  const derived = Behavon.useMemo(() => count + input.user.id.length, [count, input.user]);
  Behavon.useEffect(() => void input.step);
  Behavon.useEffect(() => void derived, [derived, input.step]);
  return undefined;
}
import type { Model, Signal as PortOnlySignal, Slot as PortOnlySlot } from "behavon";
type DependencyCompletenessModelPortType = { "signal": PortOnlySignal<any>; "slot": PortOnlySlot<any>; "update": PortOnlySignal<any> };
const dependencyCompletenessModelPort = Behavon.createPort<DependencyCompletenessModelPortType>({ "signal": Behavon.SignalType(), "slot": Behavon.SlotType(), "update": Behavon.SignalType() });
