interface StateIdentityMetadata {
  readonly path: string;
}

const markers = new WeakSet<object>();
const identities = new WeakMap<object, StateIdentityMetadata>();
const transactionIds = new WeakSet<object>();
let nextStateFamilyId = 1;

export function createStateTypeMarker(): object {
  const marker = Object.freeze({});
  markers.add(marker);
  return marker;
}

function isStateTypeMarker(value: unknown): value is object {
  return typeof value === "object" && value !== null && markers.has(value);
}

export function isStateDescriptor(value: unknown): boolean {
  const visit = (node: unknown, ancestors: Set<object>): boolean => {
    if (isStateTypeMarker(node)) return true;
    if (typeof node !== "object" || node === null || Array.isArray(node)) return false;
    const prototype = Object.getPrototypeOf(node);
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (ancestors.has(node)) return false;
    ancestors.add(node);
    const properties = Object.getOwnPropertyDescriptors(node);
    const keys = Reflect.ownKeys(node);
    if (keys.length === 0) return false;
    for (const key of keys) {
      if (typeof key !== "string" || key === "__proto__" || key === "$") return false;
      const property = properties[key] as PropertyDescriptor;
      if (!property.enumerable || !("value" in property) || !visit(property.value, ancestors)) {
        return false;
      }
    }
    ancestors.delete(node);
    return true;
  };
  return visit(value, new Set());
}

export function createStateIdentity(descriptor: unknown): object {
  const family = `StateId#${nextStateFamilyId++}`;
  const ancestors = new Set<object>();
  const build = (node: unknown, path: string): object => {
    if (isStateTypeMarker(node)) {
      const token = Object.freeze({});
      identities.set(token, Object.freeze({ path }));
      return token;
    }
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      throw new Error(`Behave.createId state descriptor node '${path}' must be StateType() or a plain object`);
    }
    const prototype = Object.getPrototypeOf(node);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`Behave.createId state descriptor node '${path}' must be a plain object`);
    }
    if (ancestors.has(node)) {
      throw new Error(`Behave.createId state descriptor contains a cycle at '${path}'`);
    }
    ancestors.add(node);
    const result = Object.create(null) as Record<string, object>;
    const properties = Object.getOwnPropertyDescriptors(node);
    const keys = Reflect.ownKeys(node);
    if (keys.length === 0) {
      throw new Error(`Behave.createId state descriptor node '${path}' must not be empty`);
    }
    for (const key of keys) {
      if (typeof key !== "string") {
        throw new Error(`Behave.createId state descriptor node '${path}' only accepts JSON string keys`);
      }
      if (key === "__proto__" || key === "$") {
        throw new Error(`Behave.createId state descriptor property '${path}.${key}' is reserved`);
      }
      const property = properties[key] as PropertyDescriptor;
      if (!property.enumerable || !("value" in property)) {
        throw new Error(`Behave.createId state descriptor property '${path}.${key}' must be an enumerable data property`);
      }
      Object.defineProperty(result, key, {
        value: build(property.value, `${path}.${key}`),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    ancestors.delete(node);
    return Object.freeze(result);
  };
  return build(descriptor, family);
}

export function requireStateIdentity(value: unknown, api: string): object {
  if (typeof value !== "object" || value === null || !identities.has(value)) {
    throw new Error(`Behave.${api} requires a StateId created by Behave.createId`);
  }
  return value;
}

export function createTransactionIdentity(): object {
  const identity = Object.freeze({});
  transactionIds.add(identity);
  return identity;
}

export function requireTransactionIdentity(value: unknown, api: string): object {
  if (typeof value !== "object" || value === null || !transactionIds.has(value)) {
    throw new Error(`Behave.transaction.${api} requires a TransactionId created by Behave.createId()`);
  }
  return value;
}
