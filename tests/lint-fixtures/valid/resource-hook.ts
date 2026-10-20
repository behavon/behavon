import Behave from "behavon";

const Resource = Behave.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});

export function ResourceModel(): string {
  const [snapshot, resource] = Behave.useResource(Resource, undefined);
  Behave.useEffect(() => {
    resource.open();
    return () => { resource.abort(); };
  }, []);
  return snapshot.phase;
}
