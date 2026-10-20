import Behave from "behavon";

const Resource = Behave.createResource({ open: () => ({}), close: () => undefined, abort: () => undefined });

export function ConditionalResourceModel(enabled: boolean): string {
  if (enabled) {
    const [snapshot] = Behave.useResource(Resource, undefined);
    return snapshot.phase;
  }
  return "closed";
}
