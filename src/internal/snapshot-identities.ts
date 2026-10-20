interface SnapshotFamilyMetadata {
  readonly root: object;
  readonly payloads: readonly object[];
  readonly label: string;
}

export interface SnapshotTokenMetadata {
  readonly family: SnapshotFamilyMetadata;
  readonly path: string;
  readonly payload: boolean;
  readonly root: boolean;
}

const markers = new WeakSet<object>();
const metadata = new WeakMap<object, SnapshotTokenMetadata>();
let nextFamilyId = 1;

export function createSnapshotTypeMarker(): object {
  const marker = Object.freeze({});
  markers.add(marker);
  return marker;
}

function isMarker(value: unknown): value is object {
  return typeof value === "object" && value !== null && markers.has(value);
}

function assertDescriptorObject(
  value: unknown,
  path: string,
  api = "createId",
): asserts value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Behave.${api} descriptor node '${path}' must be SnapshotType() or a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Behave.${api} descriptor node '${path}' must be a plain object`);
  }
}

export function assertSnapshotIdentityDescriptor(descriptor: unknown, api: string): void {
  const ancestors = new Set<object>();
  const visit = (node: unknown, path: string, root: boolean): void => {
    if (isMarker(node)) return;
    assertDescriptorObject(node, path, api);
    if (ancestors.has(node)) throw new Error(`Behave.${api} descriptor contains a cycle at '${path}'`);
    ancestors.add(node);
    const properties = Object.getOwnPropertyDescriptors(node);
    for (const key of Reflect.ownKeys(node)) {
      if (typeof key !== "string") {
        throw new Error(`Behave.${api} descriptor node '${path}' only accepts JSON string keys`);
      }
      if (key === "__proto__") {
        throw new Error(`Behave.${api} descriptor property '${path}.${key}' is reserved`);
      }
      const property = properties[key] as PropertyDescriptor;
      if (!property.enumerable || !("value" in property)) {
        throw new Error(`Behave.${api} descriptor property '${path}.${key}' must be an enumerable data property`);
      }
    }
    const markerProperty = Object.prototype.hasOwnProperty.call(properties, "$")
      ? properties["$"]
      : undefined;
    const marker = markerProperty === undefined ? undefined : markerProperty.value;
    if (markerProperty !== undefined && !isMarker(marker)) {
      throw new Error(`Behave.${api} descriptor '${path}.$' must be SnapshotType()`);
    }
    if (root && !isMarker(marker)) {
      throw new Error(
        `Behave.${api} root descriptor must declare a payload with SnapshotType() or '$'`,
      );
    }
    for (const [key, property] of Object.entries(properties)) {
      if (key === "$") continue;
      visit(property.value, `${path}.${key}`, false);
    }
    ancestors.delete(node);
  };
  visit(descriptor, `${api} descriptor`, true);
}

export function createSnapshotIdentity(descriptor: unknown): object {
  const label = `SnapshotId#${nextFamilyId++}`;
  const payloads: object[] = [];
  const entries: Array<readonly [object, string, boolean]> = [];
  const ancestors = new Set<object>();

  const build = (node: unknown, path: string, root: boolean): object => {
    if (isMarker(node)) {
      const token = {};
      payloads.push(token);
      entries.push([token, path, root]);
      return Object.freeze(token);
    }
    assertDescriptorObject(node, path);
    if (ancestors.has(node)) throw new Error(`Behave.createId descriptor contains a cycle at '${path}'`);
    ancestors.add(node);
    const token = Object.create(null) as Record<string, object>;
    const descriptors = Object.getOwnPropertyDescriptors(node);
    for (const key of Reflect.ownKeys(node)) {
      if (typeof key !== "string") {
        throw new Error(`Behave.createId descriptor node '${path}' only accepts JSON string keys`);
      }
      const property = descriptors[key] as PropertyDescriptor;
      if (!property.enumerable || !("value" in property)) {
        throw new Error(`Behave.createId descriptor property '${path}.${key}' must be an enumerable data property`);
      }
    }
    const markerProperty = Object.prototype.hasOwnProperty.call(descriptors, "$")
      ? descriptors["$"]
      : undefined;
    const marker = markerProperty === undefined ? undefined : markerProperty.value;
    if (markerProperty !== undefined && !isMarker(marker)) {
      throw new Error(`Behave.createId descriptor '${path}.$' must be SnapshotType()`);
    }
    if (isMarker(marker)) {
      payloads.push(token);
      entries.push([token, path, root]);
    }
    for (const [key, property] of Object.entries(descriptors)) {
      if (!property.enumerable || !("value" in property)) continue;
      if (key === "$") continue;
      Object.defineProperty(token, key, {
        value: build(property.value, `${path}.${key}`, false),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    ancestors.delete(node);
    return Object.freeze(token);
  };

  const root = build(descriptor, label, true);
  if (!payloads.includes(root)) {
    throw new Error("Behave.createId root descriptor must declare a payload with SnapshotType() or '$'");
  }
  const family: SnapshotFamilyMetadata = Object.freeze({
    root,
    payloads: Object.freeze(payloads.slice()),
    label,
  });
  const entryByToken = new Map(entries.map((entry) => [entry[0], entry]));
  const register = (token: object, path: string): void => {
    const entry = entryByToken.get(token);
    metadata.set(token, Object.freeze({
      family,
      path,
      payload: entry !== undefined,
      root: token === root,
    }));
    for (const [key, child] of Object.entries(token)) register(child, `${path}.${key}`);
  };
  register(root, label);
  return root;
}

export function getSnapshotTokenMetadata(value: unknown): SnapshotTokenMetadata | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return metadata.get(value);
}

export function requireSnapshotPayloadToken(value: unknown, api: string): SnapshotTokenMetadata {
  const token = getSnapshotTokenMetadata(value);
  if (token === undefined) throw new Error(`Behave.${api} requires an identity created by Behave.createId`);
  if (!token.payload) throw new Error(`Behave.${api} requires a payload-bearing snapshot identity`);
  return token;
}

export function requireSnapshotRootToken(value: unknown, api: string): SnapshotTokenMetadata {
  const token = requireSnapshotPayloadToken(value, api);
  if (!token.root) throw new Error(`Behave.${api} requires the root snapshot identity`);
  return token;
}
