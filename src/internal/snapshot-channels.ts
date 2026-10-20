import {
  requireSnapshotPayloadToken,
  requireSnapshotRootToken,
  type SnapshotTokenMetadata,
} from "./snapshot-identities.js";

interface ListenerRecord {
  readonly listener: () => void;
  active: boolean;
}

export interface SnapshotNodeRecord {
  readonly family: SnapshotFamilyRecord;
  readonly token: object;
  readonly path: string;
  current: unknown;
  readonly listeners: ListenerRecord[];
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => unknown;
}

export interface SnapshotFamilyRecord {
  readonly root: object;
  readonly label: string;
  readonly nodes: Map<object, SnapshotNodeRecord>;
  ownerCount: number;
  provisionalOwnerCount: number;
  closed: boolean;
}

const families = new Map<object, SnapshotFamilyRecord>();

function staleFamilyError(path: string): Error {
  return new Error(`Behavon snapshot identity '${path}' has no live owner`);
}

function createNode(family: SnapshotFamilyRecord, token: object, path: string): SnapshotNodeRecord {
  const listeners: ListenerRecord[] = [];
  const node = {} as SnapshotNodeRecord;
  const requireLive = (): void => {
    if (family.closed || family.ownerCount === 0) throw staleFamilyError(path);
  };
  Object.assign(node, {
    family,
    token,
    path,
    current: undefined,
    listeners,
    subscribe: (listener: () => void): (() => void) => {
      requireLive();
      const record = { listener, active: true };
      listeners.push(record);
      return () => {
        if (!record.active) return;
        record.active = false;
        const index = listeners.indexOf(record);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    getSnapshot: () => {
      requireLive();
      return node.current;
    },
  });
  return node;
}

function createFamily(metadata: SnapshotTokenMetadata): SnapshotFamilyRecord {
  const family = {
    root: metadata.family.root,
    label: metadata.family.label,
    nodes: new Map<object, SnapshotNodeRecord>(),
    ownerCount: 0,
    provisionalOwnerCount: 0,
    closed: false,
  };
  for (const token of metadata.family.payloads) {
    const nodeMetadata = requireSnapshotPayloadToken(token, "snapshot identity");
    family.nodes.set(token, createNode(family, token, nodeMetadata.path));
  }
  return family;
}

function closeFamily(family: SnapshotFamilyRecord): void {
  if (family.closed) return;
  if (families.get(family.root) === family) families.delete(family.root);
  family.closed = true;
  family.ownerCount = 0;
  family.provisionalOwnerCount = 0;
  for (const node of family.nodes.values()) {
    node.current = undefined;
    for (const record of node.listeners) record.active = false;
    node.listeners.length = 0;
  }
}

function closeIfEntirelyOwnerless(family: SnapshotFamilyRecord): void {
  if (family.ownerCount !== 0 || family.provisionalOwnerCount !== 0) return;
  closeFamily(family);
}

export function acquireSnapshotFamily(root: object): SnapshotFamilyRecord {
  const metadata = requireSnapshotRootToken(root, "useSnapshot");
  let family = families.get(metadata.family.root);
  if (family === undefined) {
    family = createFamily(metadata);
    families.set(metadata.family.root, family);
  }
  family.provisionalOwnerCount += 1;
  return family;
}

export function assertSnapshotOwnerCommittable(family: SnapshotFamilyRecord): void {
  if (family.closed || family.provisionalOwnerCount === 0) {
    throw new Error(`Behavon snapshot family '${family.label}' has no provisional owner to commit`);
  }
}

export function commitSnapshotOwner(family: SnapshotFamilyRecord): void {
  assertSnapshotOwnerCommittable(family);
  family.provisionalOwnerCount -= 1;
  family.ownerCount += 1;
}

export function abortSnapshotOwner(family: SnapshotFamilyRecord): void {
  if (family.closed || family.provisionalOwnerCount === 0) return;
  family.provisionalOwnerCount -= 1;
  closeIfEntirelyOwnerless(family);
}

export function releaseSnapshotOwner(family: SnapshotFamilyRecord): void {
  if (family.closed || family.ownerCount === 0) return;
  family.ownerCount -= 1;
  if (family.ownerCount === 0) closeFamily(family);
}

function getNode(family: SnapshotFamilyRecord, token: object): SnapshotNodeRecord {
  const node = family.nodes.get(token);
  if (node === undefined) throw new Error(`Snapshot identity does not belong to '${family.label}'`);
  return node;
}

export function getFamilyNode(family: SnapshotFamilyRecord, token: object): SnapshotNodeRecord {
  return getNode(family, token);
}

export function getLiveSnapshotNode(token: object): SnapshotNodeRecord {
  const metadata = requireSnapshotPayloadToken(token, "snapshot consumer");
  const family = families.get(metadata.family.root);
  if (family === undefined || family.closed || family.ownerCount === 0) throw staleFamilyError(metadata.path);
  return getNode(family, token);
}

export function isLiveSnapshotNode(node: SnapshotNodeRecord): boolean {
  const family = node.family;
  return !family.closed
    && (family.ownerCount > 0 || family.provisionalOwnerCount > 0)
    && families.get(family.root) === family
    && family.nodes.get(node.token) === node;
}

export function publishSnapshot(node: SnapshotNodeRecord, value: unknown): boolean {
  if (!isLiveSnapshotNode(node)) return false;
  node.current = value;
  return true;
}

export function notifySnapshotNode(node: SnapshotNodeRecord): void {
  if (!isLiveSnapshotNode(node)) return;
  const snapshot = node.listeners.slice();
  for (const record of snapshot) {
    if (record.active) record.listener();
  }
}

export function inspectSnapshotChannelForTests(token: object): Readonly<{
  current: unknown;
  ownerCount: number;
  provisionalOwnerCount: number;
  listenerCount: number;
}> | undefined {
  const metadata = requireSnapshotPayloadToken(token, "inspectSnapshotChannelForTests");
  const family = families.get(metadata.family.root);
  if (family === undefined) return undefined;
  const node = getNode(family, token);
  return {
    current: node.current,
    ownerCount: family.ownerCount,
    provisionalOwnerCount: family.provisionalOwnerCount,
    listenerCount: node.listeners.length,
  };
}

export function inspectSnapshotChannelCountForTests(): number {
  return families.size;
}
