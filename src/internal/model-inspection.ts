export interface ModelInstanceInspection {
  readonly id: number;
  readonly status: string;
  readonly model: Function;
  readonly input: unknown;
  readonly output: unknown;
  readonly inputQueue: readonly unknown[];
  readonly observers: ReadonlySet<object>;
  readonly hooks: readonly object[];
  readonly endpoints: ReadonlyMap<string, unknown>;
  readonly exports: ReadonlyMap<string, unknown>;
  readonly endpointCache: ReadonlyMap<string, unknown>;
  readonly ownerCell: object | undefined;
  readonly scheduled: boolean;
  readonly independentActivationRequired: boolean;
  readonly evaluating: boolean;
  readonly retainedOperationTargets: ReadonlySet<object>;
}

export interface RetainedOperationInspection {
  readonly kind: string;
  readonly owner?: object;
  readonly cell?: object;
  readonly instance?: object;
}

const interfaceTargets = new WeakMap<object, object>();
const retainedOperationTargets = new WeakMap<Function, object>();
let creationObserver: ((target: object) => void) | undefined;

export function registerInterfaceTarget(
  target: object,
  instance: object,
): void {
  interfaceTargets.set(target, instance);
}

export function getInterfaceTarget<T extends object>(target: object): T | undefined {
  return interfaceTargets.get(target) as T | undefined;
}

export function registerRetainedOperationForTests(
  operation: Function,
  target: object,
): void {
  retainedOperationTargets.set(operation, target);
}

export function inspectRetainedOperationForTests(
  operation: Function,
): RetainedOperationInspection {
  const target = retainedOperationTargets.get(operation);
  if (target === undefined) throw new Error("Unknown Behave retained operation inspection target");
  return target as RetainedOperationInspection;
}

export function notifyModelInstanceCreationForTests(target: object): void {
  creationObserver?.(target);
}

export function inspectModelInstanceForTests(target: object): ModelInstanceInspection {
  const instance = interfaceTargets.get(target);
  if (instance === undefined) throw new Error("Unknown Behave Model instance inspection target");
  return instance as unknown as ModelInstanceInspection;
}

export function observeModelInstanceCreationForTests(
  observer: (target: object) => void,
): () => void {
  const previous = creationObserver;
  creationObserver = observer;
  return () => {
    creationObserver = previous;
  };
}
