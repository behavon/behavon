import Behavon from "behavon";

const Resource = Behavon.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
});

export function ResourceModel(): string {
  const [snapshot, resource] = Behavon.useResource(Resource, undefined);
  Behavon.useEffect(() => {
    resource.open();
    return () => { resource.abort(); };
  }, []);
  return snapshot.phase;
}
