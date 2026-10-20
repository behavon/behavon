export interface MutableStateSubject {
  value: unknown;
  readonly queue: unknown[];
}

interface MutableStateMetadata {
  readonly identity: number;
  readonly generation: number;
  readonly owner: object;
  status: "live" | "released";
  label: object | undefined;
  lockRoot: object | undefined;
  readonly deferredUpdates: unknown[];
}

interface TransactionUpdateEntry {
  readonly scope: object;
  readonly subject: MutableStateSubject;
  readonly update: unknown;
}

export interface MutableStateInspection {
  readonly identity: number;
  readonly generation: number;
  readonly owner: object;
  readonly status: "live" | "released";
  readonly queuedUpdates: number;
  readonly labeled: boolean;
  readonly locked: boolean;
}

class MutableObserver {
  readonly #metadata = new WeakMap<MutableStateSubject, MutableStateMetadata>();
  readonly #labels = new WeakMap<object, Map<object, MutableStateSubject>>();
  readonly #transactionUpdates = new WeakMap<object, TransactionUpdateEntry[]>();
  readonly #transactionRoots = new WeakMap<object, object>();
  readonly #rootDeferredUpdates = new WeakMap<object, Map<MutableStateSubject, unknown[]>>();
  #nextIdentity = 1;
  #nextGeneration = 1;

  register(subject: MutableStateSubject, owner: object): void {
    if (this.#metadata.has(subject)) {
      throw new Error("Behavon MutableObserver cannot register the same StateCell more than once");
    }
    this.#metadata.set(subject, {
      identity: this.#nextIdentity++,
      generation: this.#nextGeneration++,
      owner,
      status: "live",
      label: undefined,
      lockRoot: undefined,
      deferredUpdates: [],
    });
  }

  registerLabel(subject: MutableStateSubject, owner: object, label: object): void {
    const metadata = this.#requireLive(subject);
    if (metadata.owner !== owner) {
      throw new Error("Behavon MutableObserver state label owner mismatch");
    }
    if (metadata.label !== undefined && metadata.label !== label) {
      throw new Error("Behavon.useLabelState cannot change its StateId at a mounted Hook position");
    }
    const labels = this.#labels.get(owner) ?? new Map<object, MutableStateSubject>();
    const existing = labels.get(label);
    if (existing !== undefined && existing !== subject) {
      throw new Error("Behavon.useLabelState cannot reuse the same StateId in one Model instance");
    }
    labels.set(label, subject);
    this.#labels.set(owner, labels);
    metadata.label = label;
  }

  labeledSubject(owner: object, label: object): MutableStateSubject | undefined {
    return this.#labels.get(owner)?.get(label);
  }

  label(subject: MutableStateSubject): object | undefined {
    return this.#requireLive(subject).label;
  }

  lock(subject: MutableStateSubject, root: object): void {
    const metadata = this.#requireLive(subject);
    if (metadata.lockRoot !== undefined && metadata.lockRoot !== root) {
      throw new Error("Behavon transaction cannot lock a StateCell held by another root transaction");
    }
    metadata.lockRoot = root;
  }

  lockRoot(subject: MutableStateSubject): object | undefined {
    return this.#requireLive(subject).lockRoot;
  }

  stage<Update>(root: object, scope: object, subject: MutableStateSubject, update: Update): void {
    const metadata = this.#requireLive(subject);
    if (metadata.lockRoot !== root) {
      throw new Error("Behavon transaction setter requires its StateId in the active root lock set");
    }
    const updates = this.#transactionUpdates.get(root) ?? [];
    updates.push({ scope, subject, update });
    this.#transactionUpdates.set(root, updates);
    this.#transactionRoots.set(scope, root);
  }

  transactionEntries(
    root: object,
    scopes: readonly object[],
  ): readonly (readonly [MutableStateSubject, readonly unknown[]])[] {
    const included = new Set(scopes);
    const combined = new Map<MutableStateSubject, unknown[]>();
    for (const entry of this.#transactionUpdates.get(root) ?? []) {
      if (!included.has(entry.scope)) continue;
      const prior = combined.get(entry.subject) ?? [];
      prior.push(entry.update);
      combined.set(entry.subject, prior);
    }
    return [...combined].map(([subject, updates]) => [subject, updates] as const);
  }

  discardTransaction(scope: object): void {
    const root = this.#transactionRoots.get(scope);
    if (root === undefined) return;
    const retained = (this.#transactionUpdates.get(root) ?? []).filter(
      (entry) => entry.scope !== scope,
    );
    if (retained.length === 0) this.#transactionUpdates.delete(root);
    else this.#transactionUpdates.set(root, retained);
    this.#transactionRoots.delete(scope);
  }

  deferUntilRootEnd<Update>(root: object, subject: MutableStateSubject, update: Update): void {
    this.#requireLive(subject);
    const updates = this.#rootDeferredUpdates.get(root) ?? new Map<MutableStateSubject, unknown[]>();
    const subjectUpdates = updates.get(subject) ?? [];
    subjectUpdates.push(update);
    updates.set(subject, subjectUpdates);
    this.#rootDeferredUpdates.set(root, updates);
  }

  releaseRootDeferred(root: object): readonly MutableStateSubject[] {
    const updates = this.#rootDeferredUpdates.get(root);
    if (updates === undefined) return [];
    const released: MutableStateSubject[] = [];
    for (const [subject, subjectUpdates] of updates) {
      const metadata = this.#metadata.get(subject);
      if (metadata?.status !== "live") continue;
      subject.queue.push(...subjectUpdates);
      released.push(subject);
    }
    this.#rootDeferredUpdates.delete(root);
    return released;
  }

  enqueueExternal<Update>(subject: MutableStateSubject, update: Update): boolean {
    const metadata = this.#requireLive(subject);
    if (metadata.lockRoot !== undefined) {
      metadata.deferredUpdates.push(update);
      return false;
    }
    subject.queue.push(update);
    return true;
  }

  unlock(root: object, subjects: readonly MutableStateSubject[]): readonly MutableStateSubject[] {
    const released: MutableStateSubject[] = [];
    for (const subject of subjects) {
      const metadata = this.#requireLive(subject);
      if (metadata.lockRoot !== root) continue;
      metadata.lockRoot = undefined;
      if (metadata.deferredUpdates.length > 0) {
        subject.queue.push(...metadata.deferredUpdates);
        metadata.deferredUpdates.splice(0, metadata.deferredUpdates.length);
        released.push(subject);
      }
    }
    return released;
  }

  enqueue<Update>(subject: MutableStateSubject, update: Update): void {
    this.#requireLive(subject);
    subject.queue.push(update);
  }

  value<Value>(subject: MutableStateSubject): Value {
    this.#requireLive(subject);
    return subject.value as Value;
  }

  queuedUpdateCount(subject: MutableStateSubject): number {
    this.#requireLive(subject);
    return subject.queue.length;
  }

  queuedUpdates<Update>(
    subject: MutableStateSubject,
    start: number,
    end: number,
  ): readonly Update[] {
    this.#requireLive(subject);
    return subject.queue.slice(start, end) as Update[];
  }

  consumePrefix(subject: MutableStateSubject, consumed: number): void {
    this.#requireLive(subject);
    if (consumed > 0) subject.queue.splice(0, consumed);
  }

  commit(subject: MutableStateSubject, value: unknown, consumed: number): void {
    this.#requireLive(subject);
    subject.value = value;
    if (consumed > 0) subject.queue.splice(0, consumed);
  }

  discardSuffix(subject: MutableStateSubject, baseline: number): void {
    this.#requireLive(subject);
    if (subject.queue.length > baseline) subject.queue.splice(baseline);
  }

  release(subject: MutableStateSubject): void {
    const metadata = this.#metadata.get(subject);
    if (metadata === undefined) {
      throw new Error("Behavon MutableObserver received an unregistered StateCell");
    }
    metadata.status = "released";
  }

  inspect(subject: MutableStateSubject): MutableStateInspection {
    const metadata = this.#metadata.get(subject);
    if (metadata === undefined) {
      throw new Error("Unknown Behavon MutableObserver StateCell inspection target");
    }
    return Object.freeze({
      identity: metadata.identity,
      generation: metadata.generation,
      owner: metadata.owner,
      status: metadata.status,
      queuedUpdates: subject.queue.length,
      labeled: metadata.label !== undefined,
      locked: metadata.lockRoot !== undefined,
    });
  }

  #requireLive(subject: MutableStateSubject): MutableStateMetadata {
    const metadata = this.#metadata.get(subject);
    if (metadata === undefined) {
      throw new Error("Behavon MutableObserver received an unregistered StateCell");
    }
    if (metadata.status !== "live") {
      throw new Error("Behavon MutableObserver received a released StateCell");
    }
    return metadata;
  }
}

export const mutableObserver = new MutableObserver();

export function inspectMutableStateForTests(
  subject: MutableStateSubject,
): MutableStateInspection {
  return mutableObserver.inspect(subject);
}
