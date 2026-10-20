import Behave from "behavon";

const Resource = Behave.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
  actions: { ping: () => undefined },
});

export function InvalidResourceModel(): undefined {
  const [, resource] = Behave.useResource(Resource, undefined);
  resource.open();
  resource.ping();
  return undefined;
}
