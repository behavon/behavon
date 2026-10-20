import Behave from "behavon";
import type { ModelInstance } from "behavon";

const moduleLabel = "stable";
const dependencySnapshot = Behave.createId(Behave.SnapshotType<string>());

interface Input {
  readonly step: number;
  readonly user: { readonly id: string };
  readonly instance: ModelInstance<number, string>;
}

function useCustomCommand(): () => void {
  return () => undefined;
}

export function DependencyCompletenessModel(input: Input): undefined {
  const [count, setCount] = Behave.useState(0);
  const [output, setInput] = Behave.useModel(input.instance);
  const [snapshot, publish] = Behave.useSnapshot(dependencySnapshot);
  const mutable = Behave.useMutable(0);
  const customCommand = useCustomCommand();
  const signalBody = Behave.useCallback(() => undefined, []);
  const signal = Behave.useSignal("signal", signalBody);
  const slotBody = Behave.useCallback(() => undefined, []);
  const slot = Behave.useSlot("slot", slotBody);
  const { step } = input;
  const user = input.user;

  const update = Behave.useCallback(() => {
    setCount((current) => current + step);
    setInput((current) => current + step);
    publish(`${moduleLabel}:${output}:${snapshot}:${user.id}`);
    mutable.set(current => current + 1);
    signal();
    slot();
    customCommand();
  }, [customCommand, output, snapshot, step, user.id]);
  Behave.useSignal("update", update);

  const derived = Behave.useMemo(() => count + input.user.id.length, [count, input.user]);
  Behave.useEffect(() => void input.step);
  Behave.useEffect(() => void derived, [derived, input.step]);
  return undefined;
}
