import Behavon from "behavon";

const Resource = Behavon.createResource({
  open: () => ({}),
  close: () => undefined,
  abort: () => undefined,
  actions: { ping: () => undefined },
});

export function InvalidResourceModel(): undefined {
  const [, resource] = Behavon.useResource(Resource, undefined);
  resource.open();
  resource.ping();
  return undefined;
}
