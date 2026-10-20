import Behavon from "behavon";

const Resource = Behavon.createResource({ open: () => ({}), close: () => undefined, abort: () => undefined });

export function ConditionalResourceModel(enabled: boolean): string {
  if (enabled) {
    const [snapshot] = Behavon.useResource(Resource, undefined);
    return snapshot.phase;
  }
  return "closed";
}
