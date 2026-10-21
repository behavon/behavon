import {
  abortSnapshotOwner,
  acquireSnapshotFamily,
  assertSnapshotOwnerCommittable,
  commitSnapshotOwner,
  getFamilyNode,
  getLiveSnapshotNode,
  isLiveSnapshotNode,
  publishSnapshot,
  notifySnapshotNode,
  releaseSnapshotOwner,
  type SnapshotFamilyRecord,
  type SnapshotNodeRecord,
} from "./internal/snapshot-channels.js";
import {
  assertSnapshotIdentityDescriptor,
  createSnapshotIdentity,
  createSnapshotTypeMarker,
  getSnapshotTokenMetadata,
  requireSnapshotPayloadToken,
  requireSnapshotRootToken,
} from "./internal/snapshot-identities.js";
import {
  getInterfaceTarget,
  registerRetainedOperationForTests,
  notifyModelInstanceCreationForTests,
  registerInterfaceTarget,
} from "./internal/model-inspection.js";
import {
  mutableObserver,
  type MutableStateSubject,
} from "./internal/mutable-observer.js";
import {
  createStateIdentity,
  createStateTypeMarker,
  createTransactionIdentity,
  isStateDescriptor,
  requireStateIdentity,
  requireTransactionIdentity,
} from "./internal/state-identities.js";

declare const snapshotTypeValue: unique symbol;
declare const snapshotIdValue: unique symbol;
declare const snapshotRootValue: unique symbol;
declare const stateTypeValue: unique symbol;
declare const stateIdValue: unique symbol;
declare const transactionIdValue: unique symbol;
declare const signalTypeArgs: unique symbol;
declare const slotTypeArgs: unique symbol;
declare const portSurface: unique symbol;
declare const modelPort: unique symbol;
declare const missingPortType: unique symbol;

interface SnapshotTypeMarker<Value> {
  readonly [snapshotTypeValue]: Value;
}

interface StateTypeMarker<Value> {
  readonly [stateTypeValue]: Value;
}

export interface StateId<Value> {
  readonly [stateIdValue]: Value;
}

export interface TransactionId {
  readonly [transactionIdValue]: true;
}

type SynchronousTransactionBody<Body extends () => unknown> =
  Extract<ReturnType<Body>, PromiseLike<unknown>> extends never ? Body : never;

export interface TransactionApi {
  start(id: TransactionId, lockTargets: readonly StateId<unknown>[]): void;
  run<Body extends () => unknown>(
    id: TransactionId,
    body: Body & SynchronousTransactionBody<Body>,
  ): ReturnType<Body>;
  commit(id: TransactionId): void;
  rollback(id: TransactionId): void;
}

export interface SnapshotId<Value> {
  readonly [snapshotIdValue]: Value;
}

export interface SnapshotRootId<Value> extends SnapshotId<Value> {
  readonly [snapshotRootValue]: true;
}

type SnapshotValue<Id extends SnapshotId<unknown>> =
  Id extends SnapshotId<infer Value> ? Value : never;

type SnapshotDescriptorNode = SnapshotTypeMarker<unknown> | SnapshotDescriptorObject;

type SnapshotDescriptorObject = {
  readonly [key: string]: SnapshotDescriptorNode;
};

type StateDescriptorNode = StateTypeMarker<unknown> | StateDescriptorObject;

type StateDescriptorObject = {
  readonly [key: string]: StateDescriptorNode;
} & { readonly $?: never };

type StateIdentity<Descriptor> =
  Descriptor extends StateTypeMarker<infer Value>
    ? StateId<Value>
    : Descriptor extends Readonly<Record<string, unknown>>
      ? { readonly [Key in keyof Descriptor]: StateIdentity<Descriptor[Key]> }
      : never;

type RootSnapshotDescriptor = SnapshotTypeMarker<unknown>
  | (SnapshotDescriptorObject & { readonly $: SnapshotTypeMarker<unknown> });

type SnapshotIdentity<Descriptor> =
  Descriptor extends SnapshotTypeMarker<infer Value>
    ? SnapshotId<Value>
    : Descriptor extends Readonly<Record<string, unknown>>
      ? SnapshotObjectIdentity<Descriptor>
      : never;

type SnapshotRootIdentity<Descriptor> =
  Descriptor extends SnapshotTypeMarker<infer Value>
    ? SnapshotRootId<Value>
    : Descriptor extends Readonly<Record<string, unknown>> & {
        readonly $: SnapshotTypeMarker<infer Value>;
      }
      ? SnapshotRootId<Value> & {
          readonly [Key in Exclude<keyof Descriptor, "$">]: SnapshotIdentity<Descriptor[Key]>;
        }
      : never;

type SnapshotObjectIdentity<Descriptor extends Readonly<Record<string, unknown>>> =
  (Descriptor extends { readonly $: SnapshotTypeMarker<infer Value> } ? SnapshotId<Value> : unknown)
  & {
    readonly [Key in Exclude<keyof Descriptor, "$">]: SnapshotIdentity<Descriptor[Key]>;
  };

type SnapshotChildValue<Value> = Value extends SnapshotId<unknown>
  ? Value | SnapshotDescendantValue<Value>
  : Value extends object
    ? SnapshotObjectChildValue<Value>
    : never;

type SnapshotObjectChildValue<Value extends object> = {
  [Key in keyof Value]: SnapshotChildValue<Value[Key]>;
}[keyof Value];

type SnapshotDescendantValue<Value extends SnapshotId<unknown>> = {
  [Key in Exclude<keyof Value, typeof snapshotIdValue>]: SnapshotChildValue<Value[Key]>;
}[Exclude<keyof Value, typeof snapshotIdValue>];

type SnapshotChildId<Root extends SnapshotRootId<unknown>> =
  Extract<SnapshotDescendantValue<Root>, SnapshotId<unknown>>;

export function SnapshotType<Value>(): SnapshotTypeMarker<Value> {
  return createSnapshotTypeMarker() as SnapshotTypeMarker<Value>;
}

export function StateType<Value>(): StateTypeMarker<Value> {
  return createStateTypeMarker() as StateTypeMarker<Value>;
}

export function createId(): TransactionId;
export function createId<const Descriptor extends RootSnapshotDescriptor | StateDescriptorObject>(
  descriptor: Descriptor,
): Descriptor extends StateDescriptorObject
  ? StateIdentity<Descriptor>
  : SnapshotRootIdentity<Descriptor>;
export function createId(descriptor?: RootSnapshotDescriptor | StateDescriptorObject): unknown {
  if (arguments.length === 0) return createTransactionIdentity() as TransactionId;
  if (isStateDescriptor(descriptor)) return createStateIdentity(descriptor);
  return createSnapshotIdentity(descriptor);
}

type DependencyList = readonly unknown[];
type EffectDependencies = DependencyList | undefined;
export type StateUpdate<State> = State | ((previous: State) => State);
export type StateSetter<State> = (update: StateUpdate<State>) => void;
type ReducerActionArgs = [] | [unknown];
export type Reducer<State, ActionArgs extends ReducerActionArgs> = (
  state: State,
  ...action: ActionArgs
) => State;
export type ReducerDispatch<ActionArgs extends ReducerActionArgs> = (...action: ActionArgs) => void;
export interface MutableHandle<State> {
  get(): State;
  set(update: StateUpdate<State>): void;
}
type UnionToIntersection<Value> = (
  Value extends unknown ? (value: Value) => void : never
) extends (value: infer Intersection) => void ? Intersection : never;

type SnapshotChildPublisher<Root extends SnapshotRootId<unknown>> = UnionToIntersection<
  SnapshotChildId<Root> extends infer Target
    ? Target extends SnapshotId<unknown>
      ? (
          target: Target & SnapshotChildId<Root>,
          update: StateUpdate<SnapshotValue<Target> | undefined>
        ) => void
      : never
    : never
>;

type SnapshotPublisher<Root extends SnapshotRootId<unknown>> =
  SnapshotChildPublisher<Root>
  & ((update: StateUpdate<SnapshotValue<Root> | undefined>) => void);
type AnyUpdateQueue = StateUpdate<any>[];
type Endpoint<Args extends readonly unknown[]> = (...args: Args) => undefined;

declare const endpointRole: unique symbol;
declare const endpointArgs: unique symbol;
declare const modelInput: unique symbol;
declare const modelOutput: unique symbol;
declare const modelInstanceIdentity: unique symbol;
declare const modelRefPort: unique symbol;
declare const connectionIdentity: unique symbol;
declare const interfaceTargetIdentity: unique symbol;

export type Signal<Args extends readonly unknown[] = readonly []> = Endpoint<Args> & {
  readonly [endpointRole]: { readonly signal: true };
};

export type Slot<Args extends readonly unknown[] = readonly []> = {
  (...args: Args): undefined;
  readonly [endpointRole]: { readonly slot: true };
  readonly [endpointArgs]: Args;
};

interface SignalTypeMarker<Args extends readonly unknown[]> {
  readonly [signalTypeArgs]: Args;
}

interface SlotTypeMarker<Args extends readonly unknown[]> {
  readonly [slotTypeArgs]: Args;
}

type SnapshotPublicKeys<Identity> = Extract<keyof Identity, string>;
type SnapshotInternalKeys = typeof snapshotIdValue | typeof snapshotRootValue;
type SnapshotReservedPublicKey = "$" | "__proto__";
type HasCallOrConstructSignature<Value> =
  Value extends (...args: any[]) => any ? true
  : Value extends abstract new (...args: any[]) => any ? true
  : false;

type SnapshotDescriptorForIdentity<Identity, Root extends boolean = true> =
  Root extends false
    ? Identity extends SnapshotRootId<unknown> ? never : SnapshotDescriptorNodeForIdentity<Identity>
    : SnapshotDescriptorNodeForIdentity<Identity>;

type SnapshotDescriptorNodeForIdentity<Identity> =
  HasCallOrConstructSignature<Identity> extends true ? never
  : true extends IsUnion<Identity> ? never
  : Identity extends SnapshotId<infer Value>
    ? Extract<SnapshotPublicKeys<Identity>, SnapshotReservedPublicKey> extends never
      ? Exclude<keyof Identity, string | SnapshotInternalKeys> extends never
        ? string extends SnapshotPublicKeys<Identity> ? never
        : SnapshotPublicKeys<Identity> extends never
          ? SnapshotTypeMarker<Value>
          : { readonly $: SnapshotTypeMarker<Value> } & {
              readonly [Name in SnapshotPublicKeys<Identity>]-?:
                {} extends Pick<Identity, Name>
                  ? never
                  : SnapshotDescriptorForIdentity<Identity[Name], false>;
            }
        : never
      : never
    : Identity extends object
      ? Extract<SnapshotPublicKeys<Identity>, SnapshotReservedPublicKey> extends never
        ? Exclude<keyof Identity, string> extends never
          ? string extends SnapshotPublicKeys<Identity> ? never
          : { readonly [Name in keyof Identity]-?:
              {} extends Pick<Identity, Name>
                ? never
                : SnapshotDescriptorForIdentity<Identity[Name], false>
            }
          : never
        : never
      : never;

type IsBothEndpointRoles<Member> =
  Member extends Signal<readonly unknown[]>
    ? Member extends Slot<readonly unknown[]> ? true : false
    : false;

type IsExactType<Actual, Canonical> =
  [Actual] extends [Canonical]
    ? [Canonical] extends [Actual] ? true : false
    : false;

type PortMemberDescriptorFor<Member> =
  IsAny<Member> extends true ? never
    : true extends IsUnion<Member> ? never
    : IsBothEndpointRoles<Member> extends true ? never
    : Member extends Signal<infer Args>
      ? IsExactType<Member, Signal<Args>> extends true ? SignalTypeMarker<Args> : never
    : Member extends Slot<infer Args>
      ? IsExactType<Member, Slot<Args>> extends true ? SlotTypeMarker<Args> : never
    : Member extends SnapshotRootId<unknown> ? SnapshotDescriptorForIdentity<Member>
    : never;

type PortDeclarationFor<Port extends object> =
  true extends IsUnion<Port> ? never
    : HasCallOrConstructSignature<Port> extends true ? never
    : string extends keyof Port ? never
    : Exclude<keyof Port, string> extends never
      ? keyof Port extends never
        ? never
        : {
          -readonly [Name in keyof Port]-?:
            Name extends ReservedEndpointName ? never
              : {} extends Pick<Port, Name> ? never
              : PortMemberDescriptorFor<Port[Name]>;
        }
      : never;

interface MissingPortType {
  readonly [missingPortType]: true;
}

export interface PortDescriptor<Surface extends object> {
  readonly [portSurface]: Surface;
}

export type Model<
  Input = any,
  Output = any,
  Port extends object = object,
> = ((input: Input) => Output) & {
  readonly [modelPort]?: Port;
};

type SlotEndpoint<Args extends readonly unknown[]> = {
  readonly [endpointRole]: { readonly slot: true };
  readonly [endpointArgs]: Args;
};

type ReservedEndpointName = "" | "__proto__" | "dispose" | "then" | "toJSON" | "constructor";

type IsAny<Value> = 0 extends (1 & Value) ? true : false;
type IsNever<Value> = [Value] extends [never] ? true : false;
type IsUnion<Value, Whole = Value> =
  Value extends unknown ? ([Whole] extends [Value] ? false : true) : never;
type IsOptionalKey<Schema extends object, Name extends keyof Schema> =
  {} extends Pick<Schema, Name> ? true : false;
type HasFunctionMember<Value> =
  Extract<Value, (...args: any[]) => any> extends never ? false : true;
interface InterfaceTarget {
  readonly [interfaceTargetIdentity]: true;
}

type ModelRefBase = InterfaceTarget & {
  readonly [modelInstanceIdentity]?: unknown;
  dispose(): void;
};

type DependencyFacade<Schema extends object> = {
  readonly [Name in keyof Schema as Name extends symbol ? never
    : Name extends ReservedEndpointName ? never
    : IsAny<Schema[Name]> extends true ? never
    : IsNever<Schema[Name]> extends true ? never
    : IsOptionalKey<Schema, Name> extends true ? never
    : [Schema[Name]] extends [{ readonly [endpointRole]: { readonly signal: true } }] ? Name
    : [Schema[Name]] extends [Slot<infer _Args>] ? Name
    : HasFunctionMember<Schema[Name]> extends true ? never
    : Name]:
    [Schema[Name]] extends [{ readonly [endpointRole]: { readonly signal: true } }] ? Schema[Name]
      : [Schema[Name]] extends [Slot<infer Args>] ? SlotEndpoint<Args>
      : Readonly<Schema>[Name];
};

export type DependencyProxy<Schema extends object = object> = InterfaceTarget & DependencyFacade<Schema>;

// A ref typed as any (or with an index signature) gives a proxy whose members are any.
type DependencyProxyForRef<Ref> =
  IsAny<Ref> extends true ? DependencyProxy & Readonly<Record<string, any>>
    : string extends keyof Ref ? DependencyProxy & Readonly<Record<string, any>>
    : Ref extends ModelRefBase ? DependencyProxy<DependencySchemaForRef<Ref>>
    : never;

/** The runtime ref proxy before it is narrowed to a Port. Internal only. */
type AnyModelRef = ModelRefBase & Readonly<Record<string, any>>;

/**
 * Slots cannot be invoked on a ref, so they are left out. The whole Port rides along in a hidden
 * member so that `usePort` can still hand the Slots out for `useConnect`.
 */
export type TypedModelRef<Port extends object> = ModelRefBase & (IsAny<Port> extends true ? Readonly<Port> : {
  readonly [Name in keyof Port as IsSlotOnly<Port[Name]> extends true ? never : Name]: Port[Name];
}) & {
  readonly [modelRefPort]?: Port;
};

type IsSlotOnly<Value> =
  IsAny<Value> extends true ? false
    : IsNever<Value> extends true ? false
    : [Value] extends [{ readonly [endpointRole]: { readonly signal: true } }] ? false
    : [Value] extends [Slot<infer _Args>] ? true
    : false;

type ModelRefForPort<Port extends object> = TypedModelRef<Port>;

type DependencySchemaForRef<Ref extends ModelRefBase> =
  typeof modelRefPort extends keyof Ref ? NonNullable<Ref[typeof modelRefPort]>
    : Omit<Ref, keyof ModelRefBase>;

export type ModelInstance<
  Input = any,
  Output = any,
  Port extends object = object,
> = ModelRefForPort<Port> & {
  readonly [modelInstanceIdentity]: readonly [input: Input, output: Output];
  readonly [modelInput]?: Input;
  readonly [modelOutput]?: Output;
};

export type ModelHandle<Input = any, Output = any> = readonly [
  output: Output,
  setInput: StateSetter<Input>,
];

export type BoundaryState<Output = any> =
  | Readonly<{ status: "active"; output: Output }>
  | Readonly<{ status: "failed"; error: unknown; reset: () => void }>;

export type Connection = { readonly [connectionIdentity]: true };

export interface ConnectionMeta {
  readonly source: TypedModelRef<object>;
  readonly signal: string;
  readonly destination: TypedModelRef<object>;
  readonly slot: string;
  readonly connection: Connection;
}

export interface EndpointInterfaceDescriptor {
  readonly name: string;
  readonly signalRegistrations: number;
  readonly slotRegistrations: number;
}

export interface BehavonInterfaceDescriptor {
  readonly endpoints: readonly EndpointInterfaceDescriptor[];
}

type UnknownCallback = (...args: unknown[]) => unknown;
type UnknownModel = (input: unknown) => unknown;
type Lifecycle = "constructing" | "active" | "disposing" | "disposed";

type RuntimePortMember =
  | Readonly<{ kind: "signal" }>
  | Readonly<{ kind: "slot" }>
  | Readonly<{ kind: "snapshot"; descriptor: RootSnapshotDescriptor }>;

interface RuntimePortDescriptor {
  readonly members: ReadonlyMap<string, RuntimePortMember>;
}

const managedCallbackRecords = new WeakMap<Function, CallbackVersion>();
const endpointHandleRecords = new WeakMap<Function, EndpointHandle>();
const connectionMetaRecords = new WeakSet<object>();
const portMemberMarkers = new WeakMap<object, "signal" | "slot">();
const portDescriptors = new WeakMap<object, RuntimePortDescriptor>();
const reservedEndpointNames: ReadonlySet<string> = new Set(
  ["", "__proto__", "dispose", "then", "toJSON", "constructor"] satisfies ReservedEndpointName[],
);
const inspectionSymbol = Symbol.for("nodejs.util.inspect.custom");

function createPortMemberMarker(kind: "signal" | "slot"): object {
  const marker = Object.freeze({});
  portMemberMarkers.set(marker, kind);
  return marker;
}

export function SignalType<Args extends readonly unknown[]>(): SignalTypeMarker<Args> {
  return createPortMemberMarker("signal") as SignalTypeMarker<Args>;
}

export function SlotType<Args extends readonly unknown[]>(): SlotTypeMarker<Args> {
  return createPortMemberMarker("slot") as SlotTypeMarker<Args>;
}

export function createPort<Port extends object = MissingPortType>(
  declaration: [Port] extends [MissingPortType] ? never : PortDeclarationFor<Port>,
): PortDescriptor<Port> {
  if (currentContext !== undefined) {
    throw new Error(
      `Behavon.createPort cannot declare a Port while evaluating Model#${currentContext.instance.id}`,
    );
  }
  if (declaration === null || typeof declaration !== "object" || Array.isArray(declaration)) {
    throw new Error("Behavon.createPort requires a non-null plain object declaration");
  }
  const prototype = Object.getPrototypeOf(declaration);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Behavon.createPort requires an ordinary object or null-prototype object");
  }
  if (Object.getOwnPropertySymbols(declaration).length > 0) {
    throw new Error("Behavon.createPort does not allow symbol member names");
  }
  const members = new Map<string, RuntimePortMember>();
  for (const name of Object.getOwnPropertyNames(declaration)) {
    const property = Object.getOwnPropertyDescriptor(declaration, name) as PropertyDescriptor;
    if (!property.enumerable || !("value" in property)) {
      throw new Error(`Behavon.createPort member '${name}' must be an enumerable data property`);
    }
    if (reservedEndpointNames.has(name)) {
      throw new Error(`Behavon.createPort member name is reserved: ${name}`);
    }
    const markerKind = typeof property.value === "object" && property.value !== null
      ? portMemberMarkers.get(property.value)
      : undefined;
    if (markerKind !== undefined) {
      members.set(name, Object.freeze({ kind: markerKind }));
      continue;
    }
    assertSnapshotIdentityDescriptor(property.value, `createPort member '${name}'`);
    members.set(name, Object.freeze({
      kind: "snapshot" as const,
      descriptor: property.value as RootSnapshotDescriptor,
    }));
  }
  const publicDescriptor = Object.freeze({}) as PortDescriptor<Port>;
  portDescriptors.set(publicDescriptor, Object.freeze({
    members,
  }));
  return publicDescriptor;
}

const resourceDefinitions = new WeakMap<object, ResourceDefinition<any, any, any, any>>();
const resourceReservedMembers = new Set([
  "open", "close", "abort",
  "openRequested", "openStarted", "opened", "openFailed",
  "closeRequested", "closeStarted", "closed", "closeFailed",
  "abortRequested", "aborted", "lost",
  "__proto__", "prototype", "constructor",
]);

export function createResource<
  Input,
  Resource,
  Reason = unknown,
  Actions extends ResourceActions<Resource> = {},
>(definition: ResourceDefinition<Input, Resource, Reason, Actions>): ResourceType<Input, Resource, Reason, Actions> {
  if (currentContext !== undefined) {
    throw new Error("Behavon.createResource must be called at module scope, outside Model evaluation");
  }
  if (typeof definition.open !== "function" || typeof definition.close !== "function" || typeof definition.abort !== "function") {
    throw new Error("Behavon.createResource requires open, close, and abort functions");
  }
  for (const name of Object.keys(definition.actions ?? {})) {
    if (resourceReservedMembers.has(name)) {
      throw new Error(`Behavon.createResource action '${name}' conflicts with the core controller surface`);
    }
    if (typeof definition.actions?.[name] !== "function") {
      throw new Error(`Behavon.createResource action '${name}' must be a function`);
    }
  }
  const type = Object.freeze({}) as ResourceType<Input, Resource, Reason, Actions>;
  resourceDefinitions.set(type, Object.freeze({ ...definition, actions: Object.freeze({ ...(definition.actions ?? {}) }) }));
  return type;
}

let nextModelId = 1;
let nextConnectionId = 1;
let nextConnectionOrder = 1;
const renderPhaseEvaluationLimit = 25;
const evaluationOperationWarnings = new WeakMap<RuntimeModelInstance, Set<string>>();

interface BaseCell {
  readonly kind: string;
  readonly owner: RuntimeModelInstance;
}

interface StateCell extends BaseCell, MutableStateSubject {
  readonly kind: "state";
  readonly label: object | undefined;
  value: unknown;
  readonly queue: StateUpdate<unknown>[];
  readonly setter: StateSetter<unknown>;
  readonly operationTarget: StateOperationTarget;
}

declare const resourceTypeIdentity: unique symbol;
declare const resourceRequestIdentity: unique symbol;
declare const resourceOperationIdentity: unique symbol;

export type ResourcePhase = "closed" | "opening" | "open" | "closing";
export type ResourceClosedBy = "initial" | "close" | "openFailed" | "closeFailed" | "abort" | "lost";
export type ResourceSnapshot<Reason = unknown> =
  | Readonly<{ phase: "closed"; closedBy: ResourceClosedBy; reason?: Reason }>
  | Readonly<{ phase: "opening" }>
  | Readonly<{ phase: "open" }>
  | Readonly<{ phase: "closing" }>;

export interface ResourceRequestId { readonly [resourceRequestIdentity]: true }
export interface ResourceOperationId { readonly [resourceOperationIdentity]: true }
export type ResourceRequestResult =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "succeeded"; outcome: "opened" | "alreadyOpen" | "closed" | "alreadyClosed" | "aborted" | "alreadyAborted" }>
  | Readonly<{ status: "failed"; error: unknown }>
  | Readonly<{ status: "superseded"; by: "open" | "close" | "abort" | "dispose" }>;
export interface ResourceRequest {
  readonly id: ResourceRequestId;
  readonly operation: ResourceOperationId | undefined;
  readonly command: "open" | "close" | "abort";
  readonly execution: "started" | "queued" | "coalesced" | "alreadySatisfied";
  getResult(): ResourceRequestResult;
}

export interface OccurrenceSource<Payload> {
  subscribe(listener: (payload: Payload) => void): () => void;
}

declare const futureRunIdentity: unique symbol;

export interface FutureRunId { readonly [futureRunIdentity]: true }
export type FutureConcurrency = "serial" | "latest";
export type FutureSnapshot<Value> =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "fulfilled"; value: Value }>
  | Readonly<{ status: "rejected"; reason: unknown }>;
export type FutureCancellationKind = "explicit" | "superseded" | "self" | "owner-dispose";

export class FutureCancellationError extends Error {
  readonly kind: FutureCancellationKind;
  declare readonly cause: unknown;

  constructor(kind: FutureCancellationKind, cause?: unknown) {
    super(`Behavon Future run was cancelled (${kind})`, { cause });
    this.name = "FutureCancellationError";
    this.kind = kind;
    this.cause = cause;
  }
}

interface AbortSignalFallback {
  readonly aborted: boolean;
  readonly reason: unknown;
  addEventListener(type: "abort", listener: () => void, options?: Readonly<{ once?: boolean }>): void;
  removeEventListener(type: "abort", listener: () => void): void;
  throwIfAborted(): void;
}

/** The standard AbortSignal where the environment declares one, otherwise its minimal shape. */
type PlatformAbortSignal = typeof globalThis extends {
  AbortSignal: { prototype: infer Signal };
} ? Signal : AbortSignalFallback;

export type FutureAbortSignal = PlatformAbortSignal;

export interface FutureFactoryContext {
  readonly signal: FutureAbortSignal;
  abort(reason?: unknown): void;
}

export type FutureFactory<Input, Value> = (
  input: Input,
  context: FutureFactoryContext,
) => Value | PromiseLike<Value>;

export type FuturePendingOccurrence<Input> = Readonly<{
  run: FutureRunId;
  input: Input;
}>;
export type FutureFulfilledOccurrence<Input, Value> = Readonly<{
  run: FutureRunId;
  input: Input;
  value: Value;
}>;
export type FutureRejectedOccurrence<Input> = Readonly<{
  run: FutureRunId;
  input: Input;
  reason: unknown;
}>;
export type FutureDiagnostic = Readonly<{
  type: "late-rejection";
  run: FutureRunId;
  input: unknown;
  cancellation: FutureCancellationError;
  error: unknown;
}>;

export interface Future<Input, Value> {
  snapshot(): FutureSnapshot<Value>;
  start(input: Input): Promise<Value>;
  abort(reason?: unknown): void;
  readonly pending: OccurrenceSource<FuturePendingOccurrence<Input>>;
  readonly fulfilled: OccurrenceSource<FutureFulfilledOccurrence<Input, Value>>;
  readonly rejected: OccurrenceSource<FutureRejectedOccurrence<Input>>;
}

export type ResourceAbortSignal = PlatformAbortSignal;

export interface ResourceActionContext<Resource> {
  readonly resource: Resource;
  readonly signal: ResourceAbortSignal;
}
type AnyResourceAction<Resource> = (context: ResourceActionContext<Resource>, ...args: any[]) => any;
type ResourceActions<Resource> = Record<string, AnyResourceAction<Resource>>;
type PublicResourceActions<Actions extends ResourceActions<any>> = {
  readonly [Name in keyof Actions]: Actions[Name] extends (context: any, ...args: infer Args) => infer Result
    ? (...args: Args) => Result extends PromiseLike<unknown> ? Promise<Awaited<Result>> : Result
    : never;
};

export interface ResourceOpenContext<Input, Reason> {
  readonly input: Input;
  readonly signal: ResourceAbortSignal;
  terminated(reason: Reason): void;
}
export interface ResourceCloseContext<Resource, Reason> {
  readonly resource: Resource;
  readonly reason: Reason | undefined;
}
export interface ResourceAbortContext<Resource, Reason> {
  readonly resource: Resource | undefined;
  readonly reason: Reason | undefined;
}
export interface ResourceCleanupErrorContext<Reason> {
  readonly command: "abort" | "dispose" | "closeFailed";
  readonly reason: Reason | undefined;
}
export interface ResourceDefinition<Input, Resource, Reason, Actions extends ResourceActions<Resource>> {
  open(context: ResourceOpenContext<Input, Reason>): Resource | PromiseLike<Resource>;
  close(context: ResourceCloseContext<Resource, Reason>): void | PromiseLike<void>;
  abort(context: ResourceAbortContext<Resource, Reason>): void | PromiseLike<void>;
  actions?: Actions;
  onCleanupError?(error: unknown, context: ResourceCleanupErrorContext<Reason>): void;
}
export interface ResourceType<Input, Resource, Reason, Actions extends ResourceActions<Resource>> {
  readonly [resourceTypeIdentity]: true;
}

type ResourceOccurrencePayload<Reason> = Readonly<{
  request: ResourceRequestId;
  operation: ResourceOperationId | undefined;
  reason?: Reason;
}>;
type ResourceStartedPayload = Readonly<{ operation: ResourceOperationId }>;
type ResourceTerminalPayload<Reason> = Readonly<{ operation: ResourceOperationId; reason?: Reason }>;
type ResourceFailurePayload = Readonly<{ operation: ResourceOperationId; error: unknown }>;
type ResourceAbortPayload<Reason> = Readonly<{
  operation: ResourceOperationId | undefined;
  reason?: Reason;
  phase: ResourcePhase;
}>;

export type ResourceController<Reason, Actions extends ResourceActions<any>> = Readonly<{
  open(): ResourceRequest;
  close(reason?: Reason): ResourceRequest;
  abort(reason?: Reason): ResourceRequest;
  openRequested: OccurrenceSource<ResourceOccurrencePayload<Reason>>;
  openStarted: OccurrenceSource<ResourceStartedPayload>;
  opened: OccurrenceSource<ResourceStartedPayload>;
  openFailed: OccurrenceSource<ResourceFailurePayload>;
  closeRequested: OccurrenceSource<ResourceOccurrencePayload<Reason>>;
  closeStarted: OccurrenceSource<ResourceStartedPayload>;
  closed: OccurrenceSource<ResourceTerminalPayload<Reason>>;
  closeFailed: OccurrenceSource<ResourceFailurePayload>;
  abortRequested: OccurrenceSource<ResourceOccurrencePayload<Reason> & { phase: ResourcePhase }>;
  aborted: OccurrenceSource<ResourceAbortPayload<Reason>>;
  lost: OccurrenceSource<ResourceTerminalPayload<Reason>>;
}> & PublicResourceActions<Actions>;

export class ResourceActionSupersededError extends Error {
  constructor() {
    super("Behavon Resource action was superseded by lifecycle invalidation");
    this.name = "ResourceActionSupersededError";
  }
}

interface ReducerCell extends BaseCell, MutableStateSubject {
  readonly kind: "reducer";
  value: unknown;
  readonly queue: ReducerActionArgs[];
  readonly dispatch: ReducerDispatch<ReducerActionArgs>;
  readonly operationTarget: ReducerOperationTarget;
}

interface MutableCell extends BaseCell {
  readonly kind: "mutable";
  value: unknown;
  readonly handle: MutableHandle<unknown>;
  readonly operationTarget: MutableOperationTarget;
}

interface MemoCell extends BaseCell {
  readonly kind: "memo";
  value: unknown;
  dependencies: DependencyList;
  readonly dependencyLength: number;
}

interface CallbackCell extends BaseCell {
  readonly kind: "callback";
  version: CallbackVersion;
  dependencies: DependencyList;
  readonly dependencyLength: number;
}

interface CallbackVersion {
  readonly provenance: object;
  readonly owner: RuntimeModelInstance;
  readonly callback: UnknownCallback;
  readonly callable: UnknownCallback;
}

interface EffectCell extends BaseCell {
  readonly kind: "effect";
  effect: () => void | (() => void);
  dependencies: EffectDependencies;
  readonly dependencyLength: number | undefined;
  cleanup: EffectCleanupLease | undefined;
  attempt: EffectActivationAttempt | undefined;
  nextAttemptGeneration: number;
}

interface EffectActivationAttempt {
  readonly generation: number;
  status: "pending" | "applied" | "setupFailed" | "skipped" | "released";
}

interface EffectCleanupLease {
  readonly attempt: EffectActivationAttempt;
  readonly cleanup: () => void;
  status: "active" | "released";
}

interface ExternalStoreLease {
  readonly generation: number;
  readonly unsubscribe: () => void;
  status: "pending" | "active" | "released";
}

interface ExternalStoreCell extends BaseCell {
  readonly kind: "externalStore";
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => unknown;
  value: unknown;
  subscription: ExternalStoreLease | undefined;
  generation: number;
  nextGeneration: number;
  readonly operationTarget: ExternalStoreOperationTarget;
}

interface ModelObservationCell extends BaseCell {
  readonly kind: "model";
  target: RuntimeModelInstance;
  output: unknown;
}

interface ModelBoundaryCell extends BaseCell {
  readonly kind: "modelBoundary";
  model: UnknownModel;
  child: RuntimeModelInstance | null;
  inputState: unknown;
  failed: boolean;
  error: unknown;
  failureGeneration: number;
  retryRequested: boolean;
  result: BoundaryState<unknown> | undefined;
  readonly operationTarget: ModelBoundaryOperationTarget;
}

interface StateOperationTarget {
  readonly kind: "stateSetter";
  readonly owner: RuntimeModelInstance;
  cell: StateCell | undefined;
}

interface ReducerOperationTarget {
  readonly kind: "reducerDispatch";
  readonly owner: RuntimeModelInstance;
  cell: ReducerCell | undefined;
}

interface MutableOperationTarget {
  readonly kind: "mutableHandle";
  readonly owner: RuntimeModelInstance;
  cell: MutableCell | undefined;
}

interface ModelInputOperationTarget {
  readonly kind: "modelInputSetter";
  instance: RuntimeModelInstance | undefined;
}

interface ModelBoundaryOperationTarget {
  readonly kind: "modelBoundaryOperation";
  readonly owner: RuntimeModelInstance;
  cell: ModelBoundaryCell | undefined;
}

interface ExternalStoreOperationTarget {
  readonly kind: "externalStoreListener";
  readonly owner: RuntimeModelInstance;
  cell: ExternalStoreCell | undefined;
}

interface ResourceOccurrenceChannel {
  readonly source: OccurrenceSource<any>;
  readonly listeners: Set<(payload: any) => void>;
}

interface ResourceOperationTarget {
  readonly kind: "resourceController";
  owner: RuntimeModelInstance | undefined;
  cell: ResourceCell | undefined;
  cleanupWindow: boolean;
}

interface RuntimeResourceRequest {
  readonly publicRequest: ResourceRequest;
  result: ResourceRequestResult;
}

interface RuntimeResourceOperation {
  readonly id: ResourceOperationId;
  readonly kind: "open" | "close";
  readonly token: number;
  readonly reason: unknown;
  readonly requests: RuntimeResourceRequest[];
  priorSnapshot?: ResourceSnapshot<any>;
  input?: unknown;
}

interface ResourceCell extends BaseCell {
  readonly kind: "resource";
  readonly type: ResourceType<any, any, any, any>;
  input: unknown;
  snapshot: ResourceSnapshot<any>;
  readonly controller: ResourceController<any, any>;
  readonly operationTarget: ResourceOperationTarget;
  readonly channels: Record<string, ResourceOccurrenceChannel>;
  resource: unknown;
  token: number;
  operation: RuntimeResourceOperation | undefined;
  queued: RuntimeResourceOperation | undefined;
  actionController: AbortController | undefined;
  readonly activeActionsByToken: Map<number, number>;
  closeWaitingForActions: boolean;
  disposed: boolean;
}

interface FutureOccurrenceChannel<Payload> {
  readonly source: OccurrenceSource<Payload>;
  readonly listeners: Set<(payload: Payload) => void>;
}

interface FutureOperationTarget {
  readonly kind: "future";
  owner: RuntimeModelInstance | undefined;
  cell: FutureCell | undefined;
}

interface RuntimeFutureRun {
  readonly id: FutureRunId;
  readonly input: unknown;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
  readonly promise: Promise<unknown>;
  controller: AbortController | undefined;
  factory: FutureFactory<unknown, unknown> | undefined;
  phase: "queued" | "pending" | "running" | "terminal";
  valid: boolean;
  cancellation: FutureCancellationError | undefined;
  underlyingSettled: boolean;
  completionSettled: boolean;
  terminalPublicationStarted: boolean;
}

interface FutureTransition {
  readonly version: number;
  readonly run: RuntimeFutureRun;
  readonly kind: "pending" | "fulfilled" | "rejected";
  readonly value: unknown;
  readonly snapshot: FutureSnapshot<unknown>;
}

interface FutureCell extends BaseCell {
  readonly kind: "future";
  factory: FutureFactory<unknown, unknown>;
  readonly concurrency: FutureConcurrency;
  snapshot: FutureSnapshot<unknown>;
  readonly future: Future<unknown, unknown>;
  readonly operationTarget: FutureOperationTarget;
  readonly pendingChannel: FutureOccurrenceChannel<FuturePendingOccurrence<unknown>>;
  readonly fulfilledChannel: FutureOccurrenceChannel<FutureFulfilledOccurrence<unknown, unknown>>;
  readonly rejectedChannel: FutureOccurrenceChannel<FutureRejectedOccurrence<unknown>>;
  active: RuntimeFutureRun | undefined;
  readonly queue: RuntimeFutureRun[];
  transition: FutureTransition | undefined;
  nextTransitionVersion: number;
  disposed: boolean;
}

type RetainedOperationTarget =
  | StateOperationTarget
  | ReducerOperationTarget
  | MutableOperationTarget
  | ModelInputOperationTarget
  | ModelBoundaryOperationTarget
  | ExternalStoreOperationTarget
  | ResourceOperationTarget
  | FutureOperationTarget;

type ModelOwnerCell = ModelBoundaryCell;

interface UsePortCell extends BaseCell {
  readonly kind: "usePort";
  target: RuntimeModelInstance;
}

interface ConnectionRecord {
  readonly id: number;
  readonly order: number;
  owner: RuntimeModelInstance;
  source: EndpointHandle | null;
  destination: EndpointHandle | null;
  status: "provisional" | "active" | "manual" | "invalid" | "ownerDisposed";
  readonly publicIdentity: Connection;
}

interface ConnectCell extends BaseCell {
  readonly kind: "connect";
  readonly record: ConnectionRecord;
  readonly disconnect: () => void;
}

interface SnapshotCell extends BaseCell {
  readonly kind: "snapshot";
  root: SnapshotRootId<unknown>;
  family: SnapshotFamilyRecord;
  readonly lease: SnapshotLease;
  readonly publish: SnapshotPublisher<SnapshotRootId<unknown>>;
}

interface SnapshotLease {
  readonly owner: RuntimeModelInstance;
  readonly family: SnapshotFamilyRecord;
  status: "provisional" | "active" | "released";
}

interface DeclarationCell extends BaseCell {
  readonly kind: "signal" | "slot";
  name: string;
  callback: CallbackVersion;
  readonly port: PortDescriptor<object> | undefined;
  readonly handle: EndpointHandle;
}

interface ExportCell extends BaseCell {
  readonly kind: "export";
  readonly value: Readonly<Record<string, unknown>>;
  readonly port: PortDescriptor<object> | undefined;
  readonly portName: string | undefined;
}

type HookCell =
  | StateCell
  | ReducerCell
  | MutableCell
  | MemoCell
  | CallbackCell
  | EffectCell
  | ExternalStoreCell
  | ResourceCell
  | FutureCell
  | ModelObservationCell
  | ModelBoundaryCell
  | UsePortCell
  | ConnectCell
  | SnapshotCell
  | DeclarationCell
  | ExportCell;

interface StateDraft {
  readonly kind: "state";
  readonly cell: StateCell;
  readonly value: unknown;
  readonly consumed: number;
}

interface ReducerDraft {
  readonly kind: "reducer";
  readonly cell: ReducerCell;
  readonly value: unknown;
  readonly consumed: number;
}

interface MutableDraft {
  readonly kind: "mutable";
  readonly cell: MutableCell;
}

interface MemoDraft {
  readonly kind: "memo";
  readonly cell: MemoCell;
  readonly value: unknown;
  readonly dependencies: DependencyList;
}

interface CallbackDraft {
  readonly kind: "callback";
  readonly cell: CallbackCell;
  readonly version: CallbackVersion;
  readonly dependencies: DependencyList;
}

interface EffectDraft {
  readonly kind: "effect";
  readonly cell: EffectCell;
  readonly effect: () => void | (() => void);
  readonly dependencies: EffectDependencies;
  readonly changed: boolean;
}

interface EffectActivation {
  readonly cell: EffectCell;
  readonly attempt: EffectActivationAttempt;
}

interface CommitPhaseOperation {
  readonly owner: RuntimeModelInstance;
  readonly run: () => void;
}

interface CommitPhaseFailure {
  readonly owner: RuntimeModelInstance;
  readonly error: unknown;
}

interface CommitPhasePass {
  readonly cleanups: CommitPhaseOperation[];
  readonly setups: CommitPhaseOperation[];
  readonly failures: CommitPhaseFailure[];
  readonly finalizations: RuntimeModelInstance[];
}

type CommitPhaseCleanupSource =
  | Readonly<{ kind: "effect"; cell: EffectCell; lease: EffectCleanupLease }>
  | Readonly<{ kind: "externalStore"; cell: ExternalStoreCell; lease: ExternalStoreLease }>
  | Readonly<{ kind: "child"; child: RuntimeModelInstance }>;

interface ExternalStoreDraft {
  readonly kind: "externalStore";
  readonly cell: ExternalStoreCell;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => unknown;
  readonly value: unknown;
  readonly subscriptionChanged: boolean;
}

interface ResourceDraft {
  readonly kind: "resource";
  readonly cell: ResourceCell;
  readonly input: unknown;
}

interface FutureDraft {
  readonly kind: "future";
  readonly cell: FutureCell;
  readonly factory: FutureFactory<unknown, unknown>;
  readonly snapshot: FutureSnapshot<unknown>;
  readonly transitionVersion: number | undefined;
}

interface ModelDraftCell {
  readonly kind: "model";
  readonly cell: ModelObservationCell;
  readonly target: RuntimeModelInstance;
  readonly output: unknown;
}

interface ModelBoundaryDraftCell {
  readonly kind: "modelBoundary";
  readonly cell: ModelBoundaryCell;
  readonly model: UnknownModel;
  readonly child: RuntimeModelInstance | null;
  readonly inputState: unknown;
  readonly failed: boolean;
  readonly error: unknown;
  readonly failureGeneration: number;
  readonly result: BoundaryState<unknown>;
}

interface UsePortDraft {
  readonly kind: "usePort";
  readonly cell: UsePortCell;
  readonly target: RuntimeModelInstance;
}

interface ConnectDraft {
  readonly kind: "connect";
  readonly cell: ConnectCell;
  readonly source: EndpointHandle;
  readonly destination: EndpointHandle;
}

interface SnapshotDraft {
  readonly kind: "snapshot";
  readonly cell: SnapshotCell;
  readonly root: SnapshotRootId<unknown>;
  readonly family: SnapshotFamilyRecord;
}

interface DeclarationDraft {
  readonly kind: "signal" | "slot";
  readonly cell: DeclarationCell;
  readonly name: string;
  readonly callback: CallbackVersion;
}

interface ExportDraft {
  readonly kind: "export";
  readonly cell: ExportCell;
  readonly value: Readonly<Record<string, unknown>>;
}

type DraftHook =
  | StateDraft
  | ReducerDraft
  | MutableDraft
  | MemoDraft
  | CallbackDraft
  | EffectDraft
  | ExternalStoreDraft
  | ResourceDraft
  | FutureDraft
  | ModelDraftCell
  | ModelBoundaryDraftCell
  | UsePortDraft
  | ConnectDraft
  | SnapshotDraft
  | DeclarationDraft
  | ExportDraft;

interface EndpointRecord {
  readonly name: string;
  readonly order: number;
  readonly signals: CallbackVersion[];
  readonly slots: CallbackVersion[];
}

interface ModelDraft {
  readonly instance: RuntimeModelInstance;
  input: unknown;
  inputConsumed: number;
  output: unknown;
  readonly hooks: DraftHook[];
  readonly endpoints: Map<string, EndpointRecord>;
  readonly exports: Map<string, unknown>;
  port: RuntimePortDescriptor | undefined;
  readonly portMembers: Set<string>;
}

interface EvaluationTransaction {
  readonly drafts: Map<RuntimeModelInstance, ModelDraft>;
  readonly order: ModelDraft[];
  readonly newInstances: Set<RuntimeModelInstance>;
  readonly disposeAfterCommit: Set<RuntimeModelInstance>;
  readonly provisionalSnapshots: Set<SnapshotLease>;
  readonly provisionalResources: Set<ResourceCell>;
  readonly provisionalFutures: Set<FutureCell>;
  readonly inputQueueBaselines: Map<AnyUpdateQueue, number>;
  readonly stateQueueBaselines: Map<MutableStateSubject, number>;
  readonly deferredFinalizations: Set<RuntimeModelInstance>;
  failureOwner: RuntimeModelInstance | undefined;
  phase: "evaluating" | "committed";
}

interface EvaluationContext {
  readonly instance: RuntimeModelInstance;
  readonly draft: ModelDraft;
  readonly transaction: EvaluationTransaction;
  readonly baseHooks: readonly HookCell[];
  readonly provisionalHooks: ReadonlySet<HookCell>;
  readonly previousAttemptHooks: readonly DraftHook[] | undefined;
  readonly stateProgress: ReadonlyMap<MutableStateSubject, StateProgress>;
  readonly modelProgress: ReadonlyMap<ModelOwnerCell, ModelProgress>;
  renderPhaseUpdateRequested: boolean;
  hookIndex: number;
}

interface StateProgress {
  readonly value: unknown;
  readonly consumed: number;
}

interface ModelProgress {
  readonly inputState: unknown;
  readonly boundary?: Readonly<{
    child: RuntimeModelInstance | null;
    failed: boolean;
    error: unknown;
    failureGeneration: number;
    result: BoundaryState<unknown>;
  }>;
}

interface EvaluationAttemptCheckpoint {
  readonly orderLength: number;
  readonly newInstances: ReadonlySet<RuntimeModelInstance>;
  readonly disposeAfterCommit: ReadonlySet<RuntimeModelInstance>;
  readonly provisionalSnapshots: ReadonlySet<SnapshotLease>;
  readonly provisionalResources: ReadonlySet<ResourceCell>;
  readonly provisionalFutures: ReadonlySet<FutureCell>;
  readonly inputQueueBaselines: ReadonlyMap<AnyUpdateQueue, number>;
  readonly stateQueueBaselines: ReadonlyMap<MutableStateSubject, number>;
  readonly failureOwner: RuntimeModelInstance | undefined;
}

interface RuntimeModelInstance {
  readonly id: number;
  model: UnknownModel;
  readonly callbackProvenance: object;
  status: Lifecycle;
  input: unknown;
  output: unknown;
  readonly inputQueue: StateUpdate<unknown>[];
  readonly inputSetter: StateSetter<unknown>;
  readonly inputOperationTarget: ModelInputOperationTarget;
  readonly observers: Set<ModelObservationCell>;
  terminalError: unknown;
  hasTerminalError: boolean;
  hooks: HookCell[];
  endpoints: Map<string, EndpointRecord>;
  exports: Map<string, unknown>;
  readonly ref: AnyModelRef;
  readonly dependencyProxy: DependencyProxy;
  readonly endpointCache: Map<string, UnknownCallback>;
  readonly disposeFunction: () => void;
  ownerCell: ModelOwnerCell | undefined;
  scheduled: boolean;
  independentActivationRequired: boolean;
  evaluating: boolean;
  readonly retainedOperationTargets: Set<RetainedOperationTarget>;
}

interface EndpointHandle {
  readonly model: RuntimeModelInstance;
  readonly name: string;
  readonly role: "signal" | "slot" | "endpoint";
  readonly callable: UnknownCallback;
}

let currentContext: EvaluationContext | undefined;
let currentManagedOwner: RuntimeModelInstance | undefined;
let restrictedHookFrame: Readonly<{
  context: EvaluationContext;
  boundary: string;
}> | undefined;
let dispatchDepth = 0;
let flushing = false;
let flushQueued = false;
let currentCommitPhasePass: CommitPhasePass | undefined;
const scheduledModels = new Set<RuntimeModelInstance>();
const activeConnections = new Set<ConnectionRecord>();
type TransactionLifecycle = "started" | "committed" | "rolledback";

interface RuntimeTransactionRoot {
  status: TransactionLifecycle;
  outer: RuntimeTransactionScope | undefined;
  readonly scopes: Set<RuntimeTransactionScope>;
  readonly lockCounts: Map<StateCell, number>;
}

interface RuntimeTransactionScope {
  readonly identity: object;
  readonly owner: RuntimeModelInstance;
  readonly root: RuntimeTransactionRoot;
  readonly locks: Set<StateCell>;
  status: TransactionLifecycle;
}

const transactionScopes = new WeakMap<object, WeakMap<RuntimeModelInstance, RuntimeTransactionScope>>();
const transactionScopesByOwner = new WeakMap<RuntimeModelInstance, Set<RuntimeTransactionScope>>();
let currentTransactionScope: RuntimeTransactionScope | undefined;
const warnedPlainTransactionState = new WeakSet<StateCell>();
const warnedPlainTransactionReducer = new WeakSet<ReducerCell>();
const disposedModel: UnknownModel = () => {
  throw new Error("Behavon cannot evaluate a disposed Model");
};

function requireTransactionOwner(api: string): RuntimeModelInstance {
  const owner = currentManagedOwner;
  if (owner === undefined || owner.status !== "active") {
    throw new Error(`Behavon.transaction.${api} must run inside a managed callback of a live Model`);
  }
  return owner;
}

function requireOwnedTransactionScope(id: TransactionId, api: string): RuntimeTransactionScope {
  const identity = requireTransactionIdentity(id, api);
  const owner = requireTransactionOwner(api);
  const scope = transactionScopes.get(identity)?.get(owner);
  if (scope === undefined) {
    throw new Error(`Behavon.transaction.${api} requires a TransactionId started by the current Model instance`);
  }
  return scope;
}

function requireCommitTransactionScope(id: TransactionId): RuntimeTransactionScope {
  const identity = requireTransactionIdentity(id, "commit");
  const owner = requireTransactionOwner("commit");
  const owned = transactionScopes.get(identity)?.get(owner);
  const currentRoot = currentTransactionScope?.root;
  if (owned !== undefined && owned.root === currentRoot) return owned;
  const upstream = currentRoot?.outer;
  if (
    upstream !== undefined &&
    upstream.root.status === "started" &&
    upstream.identity === identity
  ) return upstream;
  if (owned !== undefined) return owned;
  throw new Error(
    "Behavon.transaction.commit requires a TransactionId started by the current Model instance " +
    "or the current root transaction provenance",
  );
}

function registerTransactionScope(scope: RuntimeTransactionScope): void {
  const scopes = transactionScopesByOwner.get(scope.owner) ?? new Set<RuntimeTransactionScope>();
  scopes.add(scope);
  transactionScopesByOwner.set(scope.owner, scopes);
}

function unregisterTransactionScope(scope: RuntimeTransactionScope): void {
  const scopes = transactionScopesByOwner.get(scope.owner);
  if (scopes === undefined) return;
  scopes.delete(scope);
  if (scopes.size === 0) transactionScopesByOwner.delete(scope.owner);
}

function scheduleUnlockedUpdates(subjects: readonly MutableStateSubject[]): void {
  const owners = new Set<RuntimeModelInstance>();
  for (const subject of subjects) {
    const owner = mutableObserver.inspect(subject).owner as RuntimeModelInstance;
    if (owner.status === "active") owners.add(owner);
  }
  for (const owner of owners) scheduleModel(owner, false);
}

function releaseTransactionLocks(
  root: RuntimeTransactionRoot,
  locks: readonly StateCell[],
): void {
  const unlocked: StateCell[] = [];
  for (const cell of locks) {
    const count = root.lockCounts.get(cell) ?? 0;
    if (count > 1) {
      root.lockCounts.set(cell, count - 1);
      continue;
    }
    root.lockCounts.delete(cell);
    unlocked.push(cell);
  }
  scheduleUnlockedUpdates(mutableObserver.unlock(root, unlocked));
}

function rollbackTransactionScope(scope: RuntimeTransactionScope): void {
  if (scope.status !== "started") return;
  if (scope === scope.root.outer) {
    rollbackTransactionRoot(scope.root);
    return;
  }
  scope.status = "rolledback";
  mutableObserver.discardTransaction(scope);
  releaseTransactionLocks(scope.root, [...scope.locks]);
  unregisterTransactionScope(scope);
}

function rollbackTransactionRoot(root: RuntimeTransactionRoot): void {
  if (root.status !== "started") return;
  root.status = "rolledback";
  for (const scope of root.scopes) {
    if (scope.status === "started" || scope.status === "committed") scope.status = "rolledback";
    mutableObserver.discardTransaction(scope);
    unregisterTransactionScope(scope);
  }
  const locks = [...root.lockCounts.keys()];
  root.lockCounts.clear();
  scheduleUnlockedUpdates([
    ...mutableObserver.unlock(root, locks),
    ...mutableObserver.releaseRootDeferred(root),
  ]);
}

function completeTransactionRoot(root: RuntimeTransactionRoot): void {
  root.status = "committed";
  for (const scope of root.scopes) {
    mutableObserver.discardTransaction(scope);
    unregisterTransactionScope(scope);
  }
  const locks = [...root.lockCounts.keys()];
  root.lockCounts.clear();
  scheduleUnlockedUpdates([
    ...mutableObserver.unlock(root, locks),
    ...mutableObserver.releaseRootDeferred(root),
  ]);
}

function rollbackTransactionRootsOwnedBy(instance: RuntimeModelInstance): void {
  const roots = new Set<RuntimeTransactionRoot>();
  for (const scope of transactionScopesByOwner.get(instance) ?? []) {
    if (scope.root.status === "started") roots.add(scope.root);
  }
  for (const hook of instance.hooks) {
    if (hook.kind !== "state") continue;
    const root = mutableObserver.lockRoot(hook) as RuntimeTransactionRoot | undefined;
    if (root !== undefined) roots.add(root);
  }
  for (const root of roots) rollbackTransactionRoot(root);
}

function isThenable(value: unknown): boolean {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  ) && typeof (value as { then?: unknown }).then === "function";
}

function assertDependencyShape(
  context: EvaluationContext,
  api: "useMemo" | "useCallback" | "useEffect",
  expected: number | undefined,
  received: number | undefined,
): void {
  if (expected === undefined || received === undefined) {
    if (expected !== received) {
      throw new Error(
        `Behavon.${api} dependency shape changed in Model#${context.instance.id} at hook index ${context.hookIndex}: ` +
        `expected ${formatDependencyShape(expected)}, received ${formatDependencyShape(received)}`,
      );
    }
    return;
  }
  if (expected !== received) {
    throw new Error(
      `Behavon.${api} dependency shape changed in Model#${context.instance.id} at hook index ${context.hookIndex}: ` +
      `expected array(length ${expected}), received array(length ${received})`,
    );
  }
}

function formatDependencyShape(length: number | undefined): string {
  return length === undefined ? "omitted" : `array(length ${length})`;
}

function sameDependencies(previous: DependencyList, next: DependencyList): boolean {
  return previous.every((value, index) => Object.is(value, next[index]));
}

function assertNonEmptyName(name: unknown, subject: "endpoint"): asserts name is string {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error(`Behavon ${subject} name must be a non-empty string`);
  }
}

function assertEndpointName(name: unknown): asserts name is string {
  assertNonEmptyName(name, "endpoint");
  if (reservedEndpointNames.has(name)) {
    throw new Error(`Behavon endpoint name is reserved: ${name}`);
  }
}

function requireContext(hookName: string): EvaluationContext {
  if (currentContext === undefined) {
    throw new Error(`Behavon.${hookName} must be called while evaluating a Model`);
  }
  if (restrictedHookFrame?.context === currentContext) {
    throw new Error(
      `Behavon.${hookName} cannot be called inside ${restrictedHookFrame.boundary} ` +
      `while evaluating Model#${currentContext.instance.id}`,
    );
  }
  return currentContext;
}

function invokeUserFunction<Value>(boundary: string, invoke: () => Value): Value {
  const context = currentContext;
  if (context === undefined) return invoke();
  const previousFrame = restrictedHookFrame;
  restrictedHookFrame = { context, boundary };
  try {
    return invoke();
  } finally {
    restrictedHookFrame = previousFrame;
  }
}

function assertSetterEvaluationOwner(
  api: "useState" | "useReducer" | "useModel" | "boundary",
  target: RuntimeModelInstance,
): void {
  const source = currentContext?.instance;
  if (source !== undefined && source !== target) {
    throw new Error(
      `Behavon.${api} setter for target Model#${target.id} cannot be called while evaluating source Model#${source.id}`,
    );
  }
}

function activeHook(context: EvaluationContext, kind: HookCell["kind"]): HookCell | undefined {
  const hook = context.baseHooks[context.hookIndex];
  if (hook !== undefined && hook.kind !== kind) {
    throw new Error(
      `Behavon hook order changed in Model#${context.instance.id}: expected ${hook.kind}, received ${kind}`,
    );
  }
  return hook;
}

function enqueueStateUpdate<Value>(
  owner: RuntimeModelInstance,
  cell: StateCell,
  update: StateUpdate<Value>,
): void {
  assertSetterEvaluationOwner("useState", owner);
  if (owner.status === "disposing" || owner.status === "disposed") return;
  const context = currentContext;
  if (context?.instance === owner) {
    recordStateQueueBaseline(context, cell);
    mutableObserver.enqueue(cell, update);
    context.renderPhaseUpdateRequested = true;
    return;
  }
  const scope = currentTransactionScope;
  if (scope !== undefined && scope.root.status === "started") {
    if (cell.label === undefined) {
      if (__BEHAVON_DEVELOPMENT__ && !warnedPlainTransactionState.has(cell)) {
        warnedPlainTransactionState.add(cell);
        try {
          console.warn(
            "Behavon.useState setter called inside transaction.run is nontransactional. " +
            "Use Behavon.useLabelState and include its StateId in transaction.start.",
          );
        } catch {
          // A development diagnostic must not replace the setter result.
        }
      }
      mutableObserver.deferUntilRootEnd(scope.root, cell, update);
      return;
    }
    if (!scope.locks.has(cell)) {
      throw new Error(
        "Behavon.useLabelState setter requires its StateId in the active transaction.start lock list",
      );
    }
    mutableObserver.stage(scope.root, scope, cell, update);
    return;
  }
  if (mutableObserver.enqueueExternal(cell, update)) scheduleModel(owner, false);
}

function enqueueReducerAction(
  owner: RuntimeModelInstance,
  cell: ReducerCell,
  action: ReducerActionArgs,
): void {
  assertSetterEvaluationOwner("useReducer", owner);
  if (owner.status === "disposing" || owner.status === "disposed") return;
  const context = currentContext;
  if (context?.instance === owner) {
    recordStateQueueBaseline(context, cell);
    mutableObserver.enqueue(cell, action);
    context.renderPhaseUpdateRequested = true;
    return;
  }
  const scope = currentTransactionScope;
  if (scope !== undefined && scope.root.status === "started") {
    if (__BEHAVON_DEVELOPMENT__ && !warnedPlainTransactionReducer.has(cell)) {
      warnedPlainTransactionReducer.add(cell);
      try {
        console.warn(
          "Behavon.useReducer dispatch called inside transaction.run is nontransactional. " +
          "The action is deferred until the transaction root ends.",
        );
      } catch {
        // A development diagnostic must not replace the dispatch result.
      }
    }
    mutableObserver.deferUntilRootEnd(scope.root, cell, action);
    return;
  }
  if (mutableObserver.enqueueExternal(cell, action)) scheduleModel(owner, false);
}

function createRetainedOperationTarget<Target extends RetainedOperationTarget>(
  owner: RuntimeModelInstance,
  target: Target,
): Target {
  owner.retainedOperationTargets.add(target);
  return target;
}

function invokeRetainedModelUpdate<Value>(
  api: "useState",
  target: StateOperationTarget,
  update: StateUpdate<Value>,
): void {
  assertSetterEvaluationOwner(api, target.owner);
  const cell = target.cell;
  if (cell === undefined) return;
  enqueueStateUpdate(target.owner, cell, update);
}

function invokeRetainedReducerDispatch(
  target: ReducerOperationTarget,
  action: ReducerActionArgs,
): void {
  assertSetterEvaluationOwner("useReducer", target.owner);
  const cell = target.cell;
  if (cell === undefined) return;
  enqueueReducerAction(target.owner, cell, action);
}

function requireLiveMutableCell(target: MutableOperationTarget): MutableCell {
  const cell = target.cell;
  if (cell === undefined) {
    throw new Error("Behavon.useMutable handle requires a live Model instance");
  }
  return cell;
}

function invokeMutableUpdate<State>(
  target: MutableOperationTarget,
  update: StateUpdate<State>,
): void {
  const cell = requireLiveMutableCell(target);
  const previous = cell.value as State;
  const next = typeof update === "function"
    ? invokeUserFunction(
        "useMutable functional updater",
        () => (update as (value: State) => State)(previous),
      )
    : update;
  cell.value = next;
}

function scrubRetainedOperationTargets(instance: RuntimeModelInstance): void {
  for (const target of instance.retainedOperationTargets) {
    if (target.kind === "modelInputSetter") target.instance = undefined;
    else if (target.kind === "resourceController") {
      target.cell = undefined;
      target.owner = undefined;
      target.cleanupWindow = false;
    }
    else if (target.kind === "future") {
      target.cell = undefined;
      target.owner = undefined;
    }
    else {
      if ((target.kind === "stateSetter" || target.kind === "reducerDispatch") && target.cell !== undefined) {
        mutableObserver.release(target.cell);
      }
      target.cell = undefined;
    }
  }
  instance.retainedOperationTargets.clear();
}

function invokeModelInputUpdate(
  target: ModelInputOperationTarget,
  update: StateUpdate<unknown>,
): void {
  const instance = target.instance;
  if (instance === undefined || instance.status === "disposing" || instance.status === "disposed") {
    throw new Error("Behavon.useModel input setter requires a live Model instance");
  }
  assertSetterEvaluationOwner("useModel", instance);
  const context = currentContext;
  if (context?.instance === instance) {
    recordInputQueueBaseline(context, instance.inputQueue);
    instance.inputQueue.push(update);
    context.renderPhaseUpdateRequested = true;
    return;
  }
  instance.inputQueue.push(update);
  scheduleModel(instance, false);
}

function recordInputQueueBaseline(
  context: EvaluationContext,
  queue: AnyUpdateQueue,
): void {
  const baselines = context.transaction.inputQueueBaselines;
  if (!baselines.has(queue)) {
    baselines.set(queue, queue.length);
  }
}

function recordStateQueueBaseline(
  context: EvaluationContext,
  cell: MutableStateSubject,
): void {
  const baselines = context.transaction.stateQueueBaselines;
  if (!baselines.has(cell)) {
    baselines.set(cell, mutableObserver.queuedUpdateCount(cell));
  }
}

function discardInputQueueSuffixes(baselines: ReadonlyMap<AnyUpdateQueue, number>): void {
  for (const [queue, baseline] of baselines) {
    if (queue.length > baseline) queue.splice(baseline);
  }
}

function discardStateQueueSuffixes(baselines: ReadonlyMap<MutableStateSubject, number>): void {
  for (const [cell, baseline] of baselines) {
    mutableObserver.discardSuffix(cell, baseline);
  }
}

function applyUpdates<Value>(
  value: Value,
  queue: readonly StateUpdate<Value>[],
  boundary: "useState functional updater" | "useModel input functional updater",
): Value {
  let next = value;
  for (const update of queue) {
    next = typeof update === "function"
      ? invokeUserFunction(boundary, () => (update as (previous: Value) => Value)(next))
      : update;
  }
  return next;
}

function scheduleModel(instance: RuntimeModelInstance, independentActivationRequired: boolean): void {
  if (instance.status === "disposed" || instance.status === "disposing") return;
  instance.scheduled = true;
  if (independentActivationRequired) instance.independentActivationRequired = true;
  scheduledModels.add(instance);
  if (instance.status === "constructing" || instance.evaluating || dispatchDepth > 0 || flushing) return;
  queueFlush();
}

function queueFlush(): void {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    flushQueued = false;
    try {
      flushScheduledModels();
    } catch (error: unknown) {
      setTimeout(() => {
        throw error;
      }, 0);
    }
  });
}

function flushScheduledModels(): void {
  if (flushing) return;
  flushing = true;
  try {
    while (scheduledModels.size > 0) {
      const iterator = scheduledModels.values().next();
      if (iterator.done) break;
      const instance = iterator.value;
      scheduledModels.delete(instance);
      instance.scheduled = false;
      const independentActivationRequired = instance.independentActivationRequired;
      instance.independentActivationRequired = false;
      if (instance.status !== "active") continue;
      const transaction = createTransaction();
      try {
        try {
          prepareModel(instance, instance.input, transaction);
          assertTransactionOwnersCommittable(transaction);
          if (!independentActivationRequired && isSameValueUpdateTransaction(transaction)) {
            consumeSameValueUpdatePrefixes(transaction);
            abortTransaction(transaction);
          } else {
            commitTransaction(transaction);
          }
        } catch (error: unknown) {
          const evaluationFailure = transaction.phase === "evaluating";
          abortTransaction(transaction);
          if (!evaluationFailure) throw error;
          const failureOwner = transaction.failureOwner ?? instance;
          if (containModelEvaluationFailure(failureOwner, error)) continue;
          terminateModelOwnerRoot(failureOwner, error);
          throw error;
        }
      } finally {
        finalizeEvaluationTransaction(transaction);
      }
    }
  } finally {
    flushing = false;
    if (scheduledModels.size > 0) queueFlush();
  }
}

function containModelEvaluationFailure(owner: RuntimeModelInstance, failure: unknown): boolean {
  let current = owner;
  while (current.ownerCell !== undefined) {
    const ownerCell = current.ownerCell;
    if (ownerCell.kind === "modelBoundary") {
      const boundaryChild = ownerCell.child;
      if (boundaryChild !== null) {
        boundaryChild.ownerCell = undefined;
        try {
          disposeInstance(boundaryChild, false);
        } catch {
          // The Model evaluation failure remains authoritative over terminal cleanup failures.
        }
      }
      ownerCell.child = null;
      ownerCell.failed = true;
      ownerCell.error = failure;
      ownerCell.failureGeneration += 1;
      ownerCell.retryRequested = false;
      if (ownerCell.owner.status === "active") scheduleModel(ownerCell.owner, true);
      return true;
    }
    current = ownerCell.owner;
  }
  return false;
}

function terminateModelOwnerRoot(owner: RuntimeModelInstance, error: unknown): void {
  let root = owner;
  while (root.ownerCell !== undefined) root = root.ownerCell.owner;
  root.terminalError = error;
  root.hasTerminalError = true;
  try {
    disposeInstance(root, false);
  } catch {
    // The Model evaluation failure remains authoritative over terminal cleanup failures.
  }
}

function createTransaction(): EvaluationTransaction {
  return {
    drafts: new Map(),
    order: [],
    newInstances: new Set(),
    disposeAfterCommit: new Set(),
    provisionalSnapshots: new Set(),
    provisionalResources: new Set(),
    provisionalFutures: new Set(),
    inputQueueBaselines: new Map(),
    stateQueueBaselines: new Map(),
    deferredFinalizations: new Set(),
    failureOwner: undefined,
    phase: "evaluating",
  };
}

function isSameValueUpdateTransaction(transaction: EvaluationTransaction): boolean {
  let hasUpdate = false;
  for (const draft of transaction.order) {
    if (draft.inputConsumed > 0) {
      hasUpdate = true;
      if (!Object.is(draft.input, draft.instance.input)) return false;
    }
    for (const hook of draft.hooks) {
      if ((hook.kind === "state" || hook.kind === "reducer") && hook.consumed > 0) {
        hasUpdate = true;
        if (!Object.is(hook.value, mutableObserver.value(hook.cell))) return false;
      }
    }
  }
  return hasUpdate;
}

function consumeSameValueUpdatePrefixes(transaction: EvaluationTransaction): void {
  for (const draft of transaction.order) {
    if (draft.inputConsumed > 0) draft.instance.inputQueue.splice(0, draft.inputConsumed);
    for (const hook of draft.hooks) {
      if ((hook.kind === "state" || hook.kind === "reducer") && hook.consumed > 0) {
        mutableObserver.consumePrefix(hook.cell, hook.consumed);
      }
    }
  }
}

function abortTransaction(transaction: EvaluationTransaction): void {
  if (transaction.phase === "evaluating") {
    discardInputQueueSuffixes(transaction.inputQueueBaselines);
    discardStateQueueSuffixes(transaction.stateQueueBaselines);
  }
  for (const draft of transaction.order) {
    for (const hook of draft.hooks) {
      if (hook.kind === "connect" && hook.cell.record.status === "provisional") {
        invalidateConnection(hook.cell.record, "invalid");
      }
    }
  }
  for (const lease of transaction.provisionalSnapshots) {
    if (lease.status !== "provisional") continue;
    lease.status = "released";
    abortSnapshotOwner(lease.family);
  }
  transaction.provisionalSnapshots.clear();
  for (const resource of transaction.provisionalResources) disposeResourceCell(resource);
  transaction.provisionalResources.clear();
  for (const future of transaction.provisionalFutures) disposeFutureCell(future);
  transaction.provisionalFutures.clear();
  for (const instance of transaction.newInstances) {
    if (instance.status !== "constructing" && instance.status !== "active") continue;
    try {
      disposeInstance(instance, false, transaction.deferredFinalizations);
    } catch {
      // Transaction abort preserves the error that caused the abort.
    }
  }
}

function finalizeEvaluationTransaction(transaction: EvaluationTransaction): void {
  for (const instance of transaction.deferredFinalizations) finalizeDisposedInstance(instance);
  transaction.deferredFinalizations.clear();
}

function createModelInstance(model: UnknownModel, input: unknown, transaction: EvaluationTransaction): RuntimeModelInstance {
  const instance = {} as RuntimeModelInstance;
  const disposeFunction = () => disposeInstance(instance, true);
  const inputOperationTarget = {
    kind: "modelInputSetter" as const,
    instance,
  };
  const inputSetter: StateSetter<unknown> = (update) => {
    invokeModelInputUpdate(inputOperationTarget, update);
  };
  Object.assign(instance, {
    id: nextModelId++,
    model,
    callbackProvenance: Object.freeze({}),
    status: "constructing" as Lifecycle,
    input,
    output: undefined,
    inputQueue: [],
    inputSetter,
    inputOperationTarget,
    observers: new Set<ModelObservationCell>(),
    terminalError: undefined,
    hasTerminalError: false,
    hooks: [],
    endpoints: new Map<string, EndpointRecord>(),
    exports: new Map<string, unknown>(),
    endpointCache: new Map<string, UnknownCallback>(),
    disposeFunction,
    ownerCell: undefined,
    scheduled: false,
    independentActivationRequired: false,
    evaluating: false,
    retainedOperationTargets: new Set<RetainedOperationTarget>(),
  });
  instance.retainedOperationTargets.add(inputOperationTarget);
  registerRetainedOperationForTests(inputSetter, inputOperationTarget);
  const ref = createRefProxy(instance);
  const dependencyProxy = createDependencyProxy(instance);
  Object.assign(instance, { ref, dependencyProxy });
  notifyModelInstanceCreationForTests(ref as object);
  transaction.newInstances.add(instance);
  return instance;
}

function finalizeDisposedInstance(instance: RuntimeModelInstance): void {
  instance.status = "disposed";
  scrubRetainedOperationTargets(instance);
  instance.model = disposedModel;
  instance.input = undefined;
  instance.output = undefined;
  instance.inputQueue.splice(0, instance.inputQueue.length);
  instance.observers.clear();
  instance.hooks = [];
  instance.endpoints = new Map();
  instance.exports = new Map();
  instance.endpointCache.clear();
  instance.ownerCell = undefined;
  instance.scheduled = false;
  instance.independentActivationRequired = false;
  instance.evaluating = false;
}

function createRefProxy(instance: RuntimeModelInstance): AnyModelRef {
  const target = Object.create(null) as object;
  const proxy = new Proxy(target, {
    get(_target, property) {
      if (property === "dispose") return instance.disposeFunction;
      if (property === "then" || property === "toJSON" || property === "constructor") return undefined;
      if (property === Symbol.toStringTag) return "BehavonModelRef";
      if (property === inspectionSymbol) return undefined;
      if (typeof property === "symbol") return undefined;
      const exports = exportView(instance);
      if (exports.has(property)) {
        requireLiveInstance(instance, `public export lookup '${property}'`);
        return exports.get(property);
      }
      assertSignalExported(instance, property);
      return getEndpointHandle(instance, property).callable;
    },
  }) as AnyModelRef;
  registerInterfaceTarget(proxy as object, instance);
  return proxy;
}

function createDependencyProxy(instance: RuntimeModelInstance): DependencyProxy {
  const target = Object.create(null) as object;
  const proxy = new Proxy(target, {
    get(_target, property) {
      if (property === "then" || property === "toJSON" || property === "constructor") return undefined;
      if (property === Symbol.toStringTag) return "BehavonDependencyProxy";
      if (property === inspectionSymbol) return undefined;
      if (typeof property === "symbol") return undefined;
      const exports = exportView(instance);
      if (exports.has(property)) {
        requireLiveInstance(instance, `dependency export lookup '${property}'`);
        return exports.get(property);
      }
      // A same-name Slot stays connectable; its Signal part cannot be invoked from here.
      if ((endpointView(instance).get(property)?.slots.length ?? 0) === 0) {
        assertSignalExported(instance, property);
      }
      return getEndpointHandle(instance, property, "endpoint").callable;
    },
  }) as DependencyProxy;
  registerInterfaceTarget(proxy as object, instance);
  return proxy;
}

// Outside a Model, a Signal is reachable only after useExport opened it.
function assertSignalExported(instance: RuntimeModelInstance, name: string): void {
  if ((endpointView(instance).get(name)?.signals.length ?? 0) > 0) {
    throw new Error(`Behavon Model#${instance.id} Signal '${name}' is not exported`);
  }
}

function endpointView(instance: RuntimeModelInstance): Map<string, EndpointRecord> {
  const provisional = currentContext?.transaction.drafts.get(instance);
  return provisional?.endpoints ?? instance.endpoints;
}

function exportView(instance: RuntimeModelInstance): Map<string, unknown> {
  const provisional = currentContext?.transaction.drafts.get(instance);
  return provisional?.exports ?? instance.exports;
}

function requireLiveInstance(instance: RuntimeModelInstance, operation: string): void {
  const provisional = currentContext?.transaction.drafts.has(instance) ?? false;
  if ((instance.status !== "active" && !provisional) || instance.status === "disposing" || instance.status === "disposed") {
    throw new Error(`Behavon Model#${instance.id} is disposed during ${operation}`);
  }
}

function getEndpointHandle(
  instance: RuntimeModelInstance,
  name: string,
  role: EndpointHandle["role"] = "signal",
): EndpointHandle {
  requireLiveInstance(instance, `endpoint lookup '${name}'`);
  if (!endpointView(instance).has(name)) {
    throw new Error(`Behavon Model#${instance.id} has no endpoint '${name}'`);
  }
  const cacheKey = `${role}:${name}`;
  const cached = instance.endpointCache.get(cacheKey);
  if (cached !== undefined) return endpointHandleRecords.get(cached) as EndpointHandle;
  const callable: UnknownCallback = (...args: unknown[]) => {
    if (role === "signal") return dispatchSignal(instance, name, args);
    if (role === "slot") return dispatchSlot(instance, name, args);
    // "endpoint" handles come from usePort for names that were not exported.
    assertSignalExported(instance, name);
    return dispatchSignal(instance, name, args);
  };
  const handle = { model: instance, name, role, callable };
  instance.endpointCache.set(cacheKey, callable);
  endpointHandleRecords.set(callable, handle);
  return handle;
}

function invokeRaw(version: CallbackVersion, args: unknown[], receiver: unknown = undefined): unknown {
  const previousOwner = currentManagedOwner;
  currentManagedOwner = version.owner;
  try {
    return invokeUserFunction(
      "managed callback body",
      () => Reflect.apply(version.callback, receiver, args),
    );
  } finally {
    currentManagedOwner = previousOwner;
  }
}

function invokeEndpointRaw(
  owner: RuntimeModelInstance,
  version: CallbackVersion,
  operation: string,
  args: unknown[],
): unknown {
  requireLiveInstance(owner, operation);
  return invokeRaw(version, args);
}

function stripInboundMeta(args: unknown[]): unknown[] {
  if (args.length === 0) return args;
  const last = args[args.length - 1];
  if (typeof last === "object" && last !== null && connectionMetaRecords.has(last)) {
    return args.slice(0, -1);
  }
  return args;
}

function invokeManaged(version: CallbackVersion, receiver: unknown, args: unknown[]): unknown {
  let result: unknown;
  let failure: unknown;
  let failed = false;
  dispatchDepth += 1;
  try {
    result = invokeRaw(version, args, receiver);
  } catch (error: unknown) {
    failed = true;
    failure = error;
  } finally {
    dispatchDepth -= 1;
    if (dispatchDepth === 0 && scheduledModels.size > 0) queueFlush();
  }
  if (failed) throw failure;
  return result;
}

function constructManaged(
  version: CallbackVersion,
  args: unknown[],
  newTarget: Function,
): object {
  let result: object | undefined;
  let failure: unknown;
  let failed = false;
  dispatchDepth += 1;
  try {
    result = invokeUserFunction(
      "managed callback body",
      () => Reflect.construct(version.callback, args, newTarget),
    ) as object;
  } catch (error: unknown) {
    failed = true;
    failure = error;
  } finally {
    dispatchDepth -= 1;
    if (dispatchDepth === 0 && scheduledModels.size > 0) queueFlush();
  }
  if (failed) throw failure;
  return result as object;
}

function invokeEndpointManaged(
  owner: RuntimeModelInstance,
  version: CallbackVersion,
  operation: string,
  args: unknown[],
): unknown {
  requireLiveInstance(owner, operation);
  return invokeManaged(version, undefined, args);
}

function warnEvaluationOperation(
  api: "useSnapshot.publish" | "useResource command" | "useResource action" | "useFuture command" | "Signal" | "Slot",
  operation: string,
  key: string,
): void {
  if (!__BEHAVON_DEVELOPMENT__ || currentContext === undefined || typeof console === "undefined") return;
  const evaluator = currentContext.instance;
  const warned = evaluationOperationWarnings.get(evaluator) ?? new Set<string>();
  if (warned.has(key)) return;
  warned.add(key);
  evaluationOperationWarnings.set(evaluator, warned);
  try {
    console.warn(
      `Behavon Model#${evaluator.id} called ${api} ${operation} while evaluating. ` +
      "Move this operation to Behavon.useEffect or invoke it from a managed callback after evaluation.",
    );
  } catch {
    // A development diagnostic must not replace the operation's runtime result.
  }
}

function dispatchSignal(instance: RuntimeModelInstance, name: string, args: unknown[]): undefined {
  let failure: unknown;
  let failed = false;
  dispatchDepth += 1;
  try {
    warnEvaluationOperation("Signal", `'${name}' on Model#${instance.id}`, `signal:${instance.id}:${name}`);
    requireLiveInstance(instance, `Signal '${name}' dispatch`);
    const endpoint = endpointView(instance).get(name);
    if (endpoint === undefined) throw new Error(`Behavon Model#${instance.id} has no endpoint '${name}'`);
    if (endpoint.signals.length === 0) {
      throw new Error(`Behavon Model#${instance.id} endpoint '${name}' has no Signal registration`);
    }
    const bodies = endpoint.signals.slice();
    for (const body of bodies) invokeEndpointRaw(instance, body, `Signal '${name}' dispatch`, args);
    dispatchConnections(instance, name, stripInboundMeta(args));
  } catch (error: unknown) {
    failed = true;
    failure = error;
  } finally {
    dispatchDepth -= 1;
    if (dispatchDepth === 0 && scheduledModels.size > 0) queueFlush();
  }
  if (failed) throw failure;
  return undefined;
}

function makeVirtualConnectionMeta(destination: RuntimeModelInstance, slot: string): ConnectionMeta {
  const virtualSource = Object.freeze({
    dispose: () => undefined,
  }) as AnyModelRef;
  const meta = {
    source: virtualSource,
    signal: slot,
    destination: destination.ref,
    slot,
    connection: Object.freeze({}) as Connection,
  } as ConnectionMeta;
  connectionMetaRecords.add(meta);
  return Object.freeze(meta);
}

function dispatchSlot(instance: RuntimeModelInstance, name: string, args: unknown[]): undefined {
  let failure: unknown;
  let failed = false;
  dispatchDepth += 1;
  try {
    warnEvaluationOperation("Slot", `'${name}' on Model#${instance.id}`, `slot:${instance.id}:${name}`);
    requireLiveInstance(instance, `Slot '${name}' dispatch`);
    const endpoint = endpointView(instance).get(name);
    if (endpoint === undefined) throw new Error(`Behavon Model#${instance.id} has no endpoint '${name}'`);
    if (endpoint.slots.length === 0) {
      throw new Error(`Behavon Model#${instance.id} endpoint '${name}' has no Slot registration`);
    }
    const payload = stripInboundMeta(args);
    const meta = makeVirtualConnectionMeta(instance, name);
    for (const slot of endpoint.slots.slice()) {
      const result = invokeEndpointManaged(instance, slot, `Slot '${name}' dispatch`, [...payload, meta]);
      observeConnectedPromise(result);
    }
  } catch (error: unknown) {
    failed = true;
    failure = error;
  } finally {
    dispatchDepth -= 1;
    if (dispatchDepth === 0 && scheduledModels.size > 0) queueFlush();
  }
  if (failed) throw failure;
  return undefined;
}

function makeConnectionMeta(record: ConnectionRecord): ConnectionMeta {
  const source = record.source as EndpointHandle;
  const destination = record.destination as EndpointHandle;
  const meta = {
    source: source.model.ref,
    signal: source.name,
    destination: destination.model.ref,
    slot: destination.name,
    connection: record.publicIdentity,
  } as ConnectionMeta;
  connectionMetaRecords.add(meta);
  return Object.freeze(meta);
}

function observeConnectedPromise(result: unknown): void {
  if ((typeof result !== "object" || result === null) && typeof result !== "function") return;
  const observed = new Promise<unknown>((resolve) => {
    resolve(result);
  });
  void observed.then(
    () => undefined,
    (reason: unknown) => {
      throw reason;
    },
  );
}

function dispatchConnections(sourceModel: RuntimeModelInstance, signal: string, payload: unknown[]): void {
  const records = [...activeConnections]
    .filter((record) =>
      record.status === "active" && record.source?.model === sourceModel && record.source.name === signal)
    .sort((left, right) => left.order - right.order);
  for (const record of records) {
    if (record.status !== "active") continue;
    const source = record.source as EndpointHandle;
    requireLiveInstance(source.model, `connection source '${source.name}'`);
    const meta = makeConnectionMeta(record);
    const destination = record.destination as EndpointHandle;
    if (destination.model.status !== "active") {
      invalidateConnection(record, "invalid");
      continue;
    }
    const endpoint = destination.model.endpoints.get(destination.name);
    if (endpoint === undefined) {
      invalidateConnection(record, "invalid");
      continue;
    }
    const slots = endpoint.slots.slice();
    for (const slot of slots) {
      const result = invokeEndpointManaged(
        destination.model,
        slot,
        `connection destination '${destination.name}'`,
        [...payload, meta],
      );
      observeConnectedPromise(result);
    }
  }
}

function captureEvaluationAttempt(transaction: EvaluationTransaction): EvaluationAttemptCheckpoint {
  return {
    orderLength: transaction.order.length,
    newInstances: new Set(transaction.newInstances),
    disposeAfterCommit: new Set(transaction.disposeAfterCommit),
    provisionalSnapshots: new Set(transaction.provisionalSnapshots),
    provisionalResources: new Set(transaction.provisionalResources),
    provisionalFutures: new Set(transaction.provisionalFutures),
    inputQueueBaselines: new Map(transaction.inputQueueBaselines),
    stateQueueBaselines: new Map(transaction.stateQueueBaselines),
    failureOwner: transaction.failureOwner,
  };
}

function discardFailedEvaluationBranch(
  transaction: EvaluationTransaction,
  checkpoint: EvaluationAttemptCheckpoint,
): void {
  for (const [queue, baseline] of transaction.inputQueueBaselines) {
    if (!checkpoint.inputQueueBaselines.has(queue) && queue.length > baseline) {
      queue.splice(baseline);
    }
  }
  for (const [cell, baseline] of transaction.stateQueueBaselines) {
    if (!checkpoint.stateQueueBaselines.has(cell)) {
      mutableObserver.discardSuffix(cell, baseline);
    }
  }
  discardEvaluationAttempt(transaction, checkpoint, new Set());
  for (const queue of [...transaction.inputQueueBaselines.keys()]) {
    if (!checkpoint.inputQueueBaselines.has(queue)) {
      transaction.inputQueueBaselines.delete(queue);
    }
  }
  for (const cell of [...transaction.stateQueueBaselines.keys()]) {
    if (!checkpoint.stateQueueBaselines.has(cell)) {
      transaction.stateQueueBaselines.delete(cell);
    }
  }
  transaction.failureOwner = checkpoint.failureOwner;
}

function assertEvaluationBranchCommittable(
  transaction: EvaluationTransaction,
  checkpoint: EvaluationAttemptCheckpoint,
): void {
  for (const draft of transaction.order.slice(checkpoint.orderLength)) {
    assertModelDraftCommittable(transaction, draft);
  }
  for (const lease of transaction.provisionalSnapshots) {
    if (checkpoint.provisionalSnapshots.has(lease) || lease.status !== "provisional") continue;
    assertProvisionalSnapshotCommittable(transaction, lease);
  }
}

function discardEvaluationAttempt(
  transaction: EvaluationTransaction,
  checkpoint: EvaluationAttemptCheckpoint,
  retainedHooks: ReadonlySet<HookCell>,
): void {
  const discardedDrafts = transaction.order.slice(checkpoint.orderLength);
  const retainedSnapshotLeases = new Set<SnapshotLease>();
  for (const hook of retainedHooks) {
    if (hook.kind === "snapshot") retainedSnapshotLeases.add(hook.lease);
  }

  for (const draft of discardedDrafts) {
    for (const hook of draft.hooks) {
      if (
        hook.kind === "connect" &&
        hook.cell.record.status === "provisional" &&
        !retainedHooks.has(hook.cell)
      ) {
        invalidateConnection(hook.cell.record, "invalid");
      }
    }
    transaction.drafts.delete(draft.instance);
  }
  transaction.order.splice(checkpoint.orderLength);

  for (const lease of [...transaction.provisionalSnapshots]) {
    if (checkpoint.provisionalSnapshots.has(lease) || retainedSnapshotLeases.has(lease)) continue;
    transaction.provisionalSnapshots.delete(lease);
    if (lease.status !== "provisional") continue;
    lease.status = "released";
    abortSnapshotOwner(lease.family);
  }

  const retainedResources = new Set<ResourceCell>();
  for (const hook of retainedHooks) {
    if (hook.kind === "resource") retainedResources.add(hook);
  }
  for (const resource of [...transaction.provisionalResources]) {
    if (checkpoint.provisionalResources.has(resource) || retainedResources.has(resource)) continue;
    transaction.provisionalResources.delete(resource);
    disposeResourceCell(resource);
  }

  const retainedFutures = new Set<FutureCell>();
  for (const hook of retainedHooks) {
    if (hook.kind === "future") retainedFutures.add(hook);
  }
  for (const future of [...transaction.provisionalFutures]) {
    if (checkpoint.provisionalFutures.has(future) || retainedFutures.has(future)) continue;
    transaction.provisionalFutures.delete(future);
    disposeFutureCell(future);
  }

  for (const instance of [...transaction.disposeAfterCommit]) {
    if (!checkpoint.disposeAfterCommit.has(instance)) transaction.disposeAfterCommit.delete(instance);
  }

  for (const candidate of [...transaction.newInstances]) {
    if (checkpoint.newInstances.has(candidate)) continue;
    transaction.newInstances.delete(candidate);
    if (candidate.status !== "constructing" && candidate.status !== "active") continue;
    try {
      disposeInstance(candidate, false, transaction.deferredFinalizations);
    } catch {
      // A discarded candidate cannot replace the evaluation result with disposal failure.
    }
  }
}

function prepareModel(instance: RuntimeModelInstance, input: unknown, transaction: EvaluationTransaction): ModelDraft {
  const existing = transaction.drafts.get(instance);
  if (existing !== undefined) return existing;
  if (instance.status === "disposed" || instance.status === "disposing") {
    throw new Error(`Behavon Model#${instance.id} is disposed during evaluation`);
  }

  const previousContext = currentContext;
  const constructing = instance.status === "constructing";
  let baseHooks: readonly HookCell[] = instance.hooks;
  let provisionalHooks: ReadonlySet<HookCell> = new Set();
  let previousAttemptHooks: readonly DraftHook[] | undefined;
  let stateProgress: ReadonlyMap<MutableStateSubject, StateProgress> = new Map();
  let modelProgress: ReadonlyMap<ModelOwnerCell, ModelProgress> = new Map();
  let inputProgress = input;
  let inputConsumed = 0;
  const inputQueueBaselines = transaction.inputQueueBaselines;
  if (!inputQueueBaselines.has(instance.inputQueue)) {
    inputQueueBaselines.set(instance.inputQueue, instance.inputQueue.length);
  }

  for (const hook of instance.hooks) {
    if ((hook.kind === "state" || hook.kind === "reducer") && !transaction.stateQueueBaselines.has(hook)) {
      transaction.stateQueueBaselines.set(hook, mutableObserver.queuedUpdateCount(hook));
    }
  }
  let expectedHookCount = constructing ? undefined : instance.hooks.length;
  instance.evaluating = true;
  try {
    for (let attempt = 1; attempt <= renderPhaseEvaluationLimit; attempt += 1) {
      const checkpoint = captureEvaluationAttempt(transaction);
      const draft: ModelDraft = {
        instance,
        input: inputProgress,
        inputConsumed,
        output: instance.output,
        hooks: [],
        endpoints: new Map(),
        exports: new Map(),
        port: undefined,
        portMembers: new Set(),
      };
      transaction.drafts.set(instance, draft);
      transaction.order.push(draft);
      const context: EvaluationContext = {
        instance,
        draft,
        transaction,
        baseHooks,
        provisionalHooks,
        previousAttemptHooks,
        stateProgress,
        modelProgress,
        renderPhaseUpdateRequested: false,
        hookIndex: 0,
      };
      currentContext = context;
      const consumedInput = instance.inputQueue.length;
      draft.input = applyUpdates(
        inputProgress,
        instance.inputQueue.slice(inputConsumed, consumedInput),
        "useModel input functional updater",
      );
      draft.inputConsumed = consumedInput;
      draft.output = instance.model(draft.input);
      assertPortDeclarationComplete(draft);
      if (expectedHookCount !== undefined && context.hookIndex !== expectedHookCount) {
        throw new Error(
          `Behavon hook count changed in Model#${instance.id}: expected ${expectedHookCount}, received ${context.hookIndex}`,
        );
      }
      if (!context.renderPhaseUpdateRequested) return draft;

      const attemptHooks = draft.hooks.map((hook) => hook.cell);
      const canRetry = attempt < renderPhaseEvaluationLimit;
      const retainedHooks = constructing && canRetry
        ? new Set<HookCell>(attemptHooks)
        : new Set<HookCell>();
      const nextStateProgress = new Map<MutableStateSubject, StateProgress>();
      const nextModelProgress = new Map<ModelOwnerCell, ModelProgress>();
      for (const hook of draft.hooks) {
        if (hook.kind === "state" || hook.kind === "reducer") {
          nextStateProgress.set(hook.cell, { value: hook.value, consumed: hook.consumed });
        } else if (hook.kind === "modelBoundary") {
          nextModelProgress.set(hook.cell, {
            inputState: hook.inputState,
            boundary: {
              child: hook.child,
              failed: hook.failed,
              error: hook.error,
              failureGeneration: hook.failureGeneration,
              result: hook.result,
            },
          });
        }
      }
      inputProgress = draft.input;
      inputConsumed = draft.inputConsumed;
      discardEvaluationAttempt(transaction, checkpoint, retainedHooks);
      if (!canRetry) {
        throw new Error(
          `Behavon Model#${instance.id} exceeded ${renderPhaseEvaluationLimit} render-phase evaluation attempts`,
        );
      }

      if (constructing) {
        baseHooks = attemptHooks;
        provisionalHooks = new Set(attemptHooks);
        expectedHookCount = attemptHooks.length;
      }
      previousAttemptHooks = draft.hooks;
      stateProgress = nextStateProgress;
      modelProgress = nextModelProgress;
    }
    throw new Error(`Behavon Model#${instance.id} exceeded the render-phase evaluation limit`);
  } catch (error: unknown) {
    if (transaction.failureOwner === undefined) transaction.failureOwner = instance;
    throw error;
  } finally {
    currentContext = previousContext;
    instance.evaluating = false;
  }
}

function assertTransactionOwnersCommittable(transaction: EvaluationTransaction): void {
  for (const draft of transaction.order) {
    assertModelDraftCommittable(transaction, draft);
    for (const hook of draft.hooks) {
      if (hook.kind === "model" && (
        hook.target.status === "disposing" || hook.target.status === "disposed"
      )) {
        transaction.failureOwner = draft.instance;
        throw new Error(
          `Behavon.useModel target Model#${hook.target.id} was disposed during evaluation`,
        );
      }
    }
  }
}

function assertModelDraftCommittable(
  transaction: EvaluationTransaction,
  draft: ModelDraft,
): void {
  if (draft.instance.status === "disposing" || draft.instance.status === "disposed") {
    transaction.failureOwner = draft.instance;
    throw new Error(
      `Behavon Model#${draft.instance.id} was disposed during evaluation and cannot be committed`,
    );
  }
}

function assertProvisionalSnapshotCommittable(
  transaction: EvaluationTransaction,
  lease: SnapshotLease,
): void {
  try {
    assertSnapshotOwnerCommittable(lease.family);
  } catch (error: unknown) {
    transaction.failureOwner = lease.owner;
    throw error;
  }
}

function commitTransaction(
  transaction: EvaluationTransaction,
  afterActivation?: () => void,
): void {
  assertTransactionOwnersCommittable(transaction);
  for (const lease of transaction.provisionalSnapshots) {
    if (lease.status === "provisional") assertProvisionalSnapshotCommittable(transaction, lease);
  }

  const changedEffects: EffectActivation[] = [];
  const cleanupSources: CommitPhaseCleanupSource[] = [];
  const observersToSchedule = new Set<RuntimeModelInstance>();
  const futureTransitions: Array<readonly [FutureCell, FutureTransition]> = [];

  for (const draft of transaction.order) {
    const instance = draft.instance;
    const previousOutput = instance.output;
    const committedHooks: HookCell[] = [];
    for (const hook of draft.hooks) {
      switch (hook.kind) {
        case "state":
          mutableObserver.commit(hook.cell, hook.value, hook.consumed);
          committedHooks.push(hook.cell);
          break;
        case "reducer":
          mutableObserver.commit(hook.cell, hook.value, hook.consumed);
          committedHooks.push(hook.cell);
          break;
        case "mutable":
          committedHooks.push(hook.cell);
          break;
        case "memo":
          hook.cell.value = hook.value;
          hook.cell.dependencies = hook.dependencies;
          committedHooks.push(hook.cell);
          break;
        case "callback":
          hook.cell.version = hook.version;
          hook.cell.dependencies = hook.dependencies;
          committedHooks.push(hook.cell);
          break;
        case "effect":
          if (hook.changed && hook.cell.cleanup !== undefined) {
            cleanupSources.push({ kind: "effect", cell: hook.cell, lease: hook.cell.cleanup });
          }
          hook.cell.effect = hook.effect;
          hook.cell.dependencies = hook.dependencies;
          committedHooks.push(hook.cell);
          if (hook.changed) {
            const attempt: EffectActivationAttempt = {
              generation: hook.cell.nextAttemptGeneration,
              status: "pending",
            };
            hook.cell.nextAttemptGeneration += 1;
            hook.cell.attempt = attempt;
            changedEffects.push({ cell: hook.cell, attempt });
          }
          break;
        case "externalStore":
          if (hook.subscriptionChanged && hook.cell.subscription !== undefined) {
            cleanupSources.push({
              kind: "externalStore",
              cell: hook.cell,
              lease: hook.cell.subscription,
            });
          }
          hook.cell.subscribe = hook.subscribe;
          hook.cell.getSnapshot = hook.getSnapshot;
          hook.cell.value = hook.value;
          committedHooks.push(hook.cell);
          break;
        case "resource":
          hook.cell.input = hook.input;
          transaction.provisionalResources.delete(hook.cell);
          committedHooks.push(hook.cell);
          break;
        case "future": {
          hook.cell.factory = hook.factory;
          transaction.provisionalFutures.delete(hook.cell);
          hook.cell.snapshot = hook.snapshot;
          committedHooks.push(hook.cell);
          const transition = hook.cell.transition;
          if (transition !== undefined && transition.version === hook.transitionVersion) {
            futureTransitions.push([hook.cell, transition]);
          }
          break;
        }
        case "model": {
          if (hook.cell.target !== hook.target) {
            hook.cell.target.observers.delete(hook.cell);
            hook.cell.target = hook.target;
          }
          hook.cell.output = hook.output;
          hook.target.observers.add(hook.cell);
          committedHooks.push(hook.cell);
          break;
        }
        case "modelBoundary": {
          if (
            hook.child !== null &&
            hook.child.status === "disposed" &&
            hook.cell.child === null
          ) {
            // Preserve a terminal owner-cell correction if the Child was disposed
            // after this Boundary draft already read it.
            committedHooks.push(hook.cell);
            break;
          }
          const oldChild = hook.cell.child;
          hook.cell.model = hook.model;
          hook.cell.child = hook.child;
          hook.cell.inputState = hook.inputState;
          hook.cell.failed = hook.failed;
          hook.cell.error = hook.error;
          hook.cell.failureGeneration = hook.failureGeneration;
          hook.cell.retryRequested = false;
          hook.cell.result = hook.result;
          if (oldChild !== null && oldChild !== hook.child) {
            transaction.disposeAfterCommit.add(oldChild);
            cleanupSources.push({ kind: "child", child: oldChild });
          }
          if (hook.child !== null) hook.child.ownerCell = hook.cell;
          committedHooks.push(hook.cell);
          break;
        }
        case "usePort":
          hook.cell.target = hook.target;
          committedHooks.push(hook.cell);
          break;
        case "connect":
          hook.cell.record.source = hook.source;
          hook.cell.record.destination = hook.destination;
          committedHooks.push(hook.cell);
          break;
        case "snapshot":
          if (hook.cell.lease.status === "provisional") {
            commitSnapshotOwner(hook.family);
            hook.cell.lease.status = "active";
            transaction.provisionalSnapshots.delete(hook.cell.lease);
          }
          hook.cell.root = hook.root;
          hook.cell.family = hook.family;
          committedHooks.push(hook.cell);
          break;
        case "signal":
        case "slot":
          hook.cell.name = hook.name;
          hook.cell.callback = hook.callback;
          committedHooks.push(hook.cell);
          break;
        case "export":
          committedHooks.push(hook.cell);
          break;
      }
    }
    instance.input = draft.input;
    instance.inputQueue.splice(0, draft.inputConsumed);
    instance.output = draft.output;
    instance.hooks = committedHooks;
    instance.endpoints = draft.endpoints;
    instance.exports = draft.exports;
    instance.status = "active";
    if (!Object.is(previousOutput, draft.output)) {
      for (const observer of instance.observers) {
        if (observer.owner.status === "active") observersToSchedule.add(observer.owner);
      }
      const ownerCell = instance.ownerCell;
      if (
        ownerCell?.kind === "modelBoundary" &&
        ownerCell.child === instance &&
        ownerCell.owner.status === "active" &&
        ownerCell.owner.hooks.includes(ownerCell) &&
        !transaction.drafts.has(ownerCell.owner)
      ) observersToSchedule.add(ownerCell.owner);
    }
  }
  transaction.phase = "committed";

  for (const draft of transaction.order) {
    for (const hook of draft.hooks) {
      if (
        hook.kind === "model" &&
        hook.target.status === "active" &&
        !Object.is(hook.output, hook.target.output)
      ) observersToSchedule.add(hook.cell.owner);
    }
  }
  for (const observer of observersToSchedule) scheduleModel(observer, true);

  for (const draft of transaction.order) {
    for (const hook of draft.hooks) {
      if (hook.kind !== "connect") continue;
      const record = hook.cell.record;
      if (
        record.status === "provisional"
      ) {
        record.status = "active";
        activeConnections.add(record);
      }
    }
  }

  afterActivation?.();

  const pass: CommitPhasePass = { cleanups: [], setups: [], failures: [], finalizations: [] };
  for (const source of cleanupSources) {
    if (source.kind === "child") {
      collectCommitPhaseDisposal(source.child, pass);
    } else if (source.kind === "effect") {
      pass.cleanups.push({
        owner: source.cell.owner,
        run: () => consumeEffectCleanup(source.cell, source.lease),
      });
    } else {
      pass.cleanups.push({
        owner: source.cell.owner,
        run: () => consumeExternalStoreLease(source.cell, source.lease),
      });
    }
  }
  for (const draft of transaction.order) {
    for (const hook of draft.hooks) {
      if (hook.kind === "externalStore" && hook.subscriptionChanged) {
        pass.setups.push({ owner: hook.cell.owner, run: () => activateExternalStore(hook.cell, true) });
      } else if (hook.kind === "effect" && hook.changed) {
        const activation = changedEffects.find((candidate) => candidate.cell === hook.cell);
        if (activation !== undefined) {
          pass.setups.push({
            owner: hook.cell.owner,
            run: () => activateEffect(hook.cell, activation.attempt),
          });
        }
      }
    }
  }
  runCommitPhasePass(pass);

  for (const [cell, transition] of futureTransitions) publishFutureTransition(cell, transition);

  for (const instance of transaction.newInstances) instance.scheduled = false;
  if (scheduledModels.size > 0 && dispatchDepth === 0 && !flushing) queueFlush();
}

function activateEffect(cell: EffectCell, attempt: EffectActivationAttempt): void {
  if (!isCurrentEffectAttempt(cell, attempt)) {
    attempt.status = "skipped";
    return;
  }

  if (!isCurrentEffectAttempt(cell, attempt)) {
    attempt.status = "skipped";
    return;
  }

  let cleanup: void | (() => void);
  try {
    cleanup = invokeUserFunction("useEffect setup", cell.effect);
  } catch (error: unknown) {
    attempt.status = "setupFailed";
    throw error;
  }

  attempt.status = "applied";
  if (typeof cleanup !== "function") {
    if (!isCurrentEffectAttempt(cell, attempt)) attempt.status = "released";
    return;
  }

  const lease: EffectCleanupLease = {
    attempt,
    cleanup,
    status: "active",
  };
  if (!isCurrentEffectAttempt(cell, attempt)) {
    consumeEffectCleanup(cell, lease);
    return;
  }
  cell.cleanup = lease;
}

function consumeEffectCleanup(cell: EffectCell, lease: EffectCleanupLease): void {
  if (lease.status === "released") return;
  releaseEffectCleanupLease(cell, lease);
  invokeUserFunction("useEffect cleanup", lease.cleanup);
}

function releaseEffectCleanupLease(cell: EffectCell, lease: EffectCleanupLease): void {
  lease.status = "released";
  if (cell.cleanup === lease) cell.cleanup = undefined;
  lease.attempt.status = "released";
}

function activateExternalStore(cell: ExternalStoreCell, changed: boolean): void {
  if (!changed || !isCurrentCommittedHook(cell)) return;
  const generation = cell.nextGeneration;
  cell.nextGeneration += 1;
  const operationTarget = cell.operationTarget;
  const listener = () => {
    const activeCell = operationTarget.cell;
    if (
      activeCell === undefined ||
      operationTarget.owner.status !== "active" ||
      activeCell.generation !== generation ||
      activeCell.subscription?.generation !== generation ||
      activeCell.subscription.status !== "active"
    ) return;
    let changedSnapshot = true;
    try {
      const next = invokeUserFunction(
        "useSyncExternalStore notification getSnapshot",
        activeCell.getSnapshot,
      );
      changedSnapshot = !Object.is(next, activeCell.value);
    } catch {
      // A changed-check failure requests an authoritative evaluation read.
    }
    if (changedSnapshot) scheduleModel(operationTarget.owner, true);
  };
  registerRetainedOperationForTests(listener, operationTarget);
  const unsubscribe = invokeUserFunction(
    "useSyncExternalStore subscribe",
    () => cell.subscribe(listener),
  );
  const subscription: ExternalStoreLease = {
    generation,
    unsubscribe,
    status: "pending",
  };
  if (!isCurrentCommittedHook(cell)) {
    consumeExternalStoreLease(cell, subscription);
    return;
  }
  cell.subscription = subscription;
  let changedSnapshot = true;
  try {
    const after = invokeUserFunction(
      "useSyncExternalStore post-subscribe getSnapshot",
      cell.getSnapshot,
    );
    changedSnapshot = !Object.is(after, cell.value);
  } catch {
    // A changed-check failure keeps the active lease and requests an authoritative evaluation read.
  }
  subscription.status = "active";
  cell.generation = generation;
  if (changedSnapshot) scheduleModel(cell.owner, true);
}

function consumeExternalStoreLease(cell: ExternalStoreCell, subscription: ExternalStoreLease): void {
  if (subscription.status === "released") return;
  subscription.status = "released";
  if (cell.subscription === subscription) cell.subscription = undefined;
  invokeUserFunction("useSyncExternalStore unsubscribe", subscription.unsubscribe);
}

function isCurrentCommittedHook(cell: EffectCell | ExternalStoreCell): boolean {
  return cell.owner.status === "active" && cell.owner.hooks.includes(cell);
}

function isCurrentEffectAttempt(cell: EffectCell, attempt: EffectActivationAttempt): boolean {
  return cell.attempt === attempt && isCurrentCommittedHook(cell);
}

function releaseModelObservations(instance: RuntimeModelInstance): void {
  for (const hook of instance.hooks) {
    if (hook.kind === "model") hook.target.observers.delete(hook);
  }
}

function invalidateModelObservers(instance: RuntimeModelInstance): void {
  const observers = [...instance.observers];
  instance.observers.clear();
  for (const observer of observers) {
    if (observer.owner.status === "active") scheduleModel(observer.owner, true);
  }
}

function runCommitPhaseOperation(operation: CommitPhaseOperation, pass: CommitPhasePass): void {
  const previousPass = currentCommitPhasePass;
  currentCommitPhasePass = pass;
  try {
    operation.run();
  } catch (error: unknown) {
    pass.failures.push({ owner: operation.owner, error });
  } finally {
    currentCommitPhasePass = previousPass;
  }
}

function runCommitPhasePass(pass: CommitPhasePass): void {
  for (const operation of pass.cleanups) runCommitPhaseOperation(operation, pass);
  for (const operation of pass.setups) runCommitPhaseOperation(operation, pass);
  try {
    routeCommitPhaseFailures(pass.failures);
  } finally {
    finalizeCommitPhaseInstances(pass);
  }
}

function finalizeCommitPhaseInstances(pass: CommitPhasePass): void {
  for (const instance of new Set(pass.finalizations)) finalizeDisposedInstance(instance);
  pass.finalizations.splice(0);
}

function collectCommitPhaseDisposal(instance: RuntimeModelInstance, pass: CommitPhasePass): void {
  if (instance.status === "disposed" || instance.status === "disposing") return;
  rollbackTransactionRootsOwnedBy(instance);
  instance.status = "disposing";
  scheduledModels.delete(instance);
  instance.scheduled = false;
  instance.independentActivationRequired = false;
  releaseModelObservations(instance);
  invalidateModelObservers(instance);

  for (const record of [...activeConnections]) {
    if (record.owner === instance) invalidateConnection(record, "ownerDisposed");
    else if (record.source?.model === instance || record.destination?.model === instance) {
      invalidateConnection(record, "invalid");
    }
  }

  const resources: ResourceCell[] = [];
  const futures: FutureCell[] = [];
  for (const hook of instance.hooks) {
    if (hook.kind === "externalStore") {
      hook.generation = hook.nextGeneration;
      hook.nextGeneration += 1;
      const subscription = hook.subscription;
      hook.subscription = undefined;
      if (subscription !== undefined && subscription.status !== "released") {
        pass.cleanups.push({
          owner: instance,
          run: () => consumeExternalStoreLease(hook, subscription),
        });
      }
    } else if (hook.kind === "resource") {
      hook.operationTarget.cleanupWindow = true;
      resources.push(hook);
    } else if (hook.kind === "future") {
      futures.push(hook);
    } else if (hook.kind === "modelBoundary" && hook.child !== null) {
      collectCommitPhaseDisposal(hook.child, pass);
    } else if (hook.kind === "effect" && hook.cleanup !== undefined) {
      const cleanup = hook.cleanup;
      pass.cleanups.push({
        owner: instance,
        run: () => consumeEffectCleanup(hook, cleanup),
      });
    } else if (hook.kind === "snapshot" && hook.lease.status === "active") {
      hook.lease.status = "released";
      releaseSnapshotOwner(hook.family);
    }
  }

  for (const resource of resources) {
    pass.cleanups.push({ owner: instance, run: () => disposeResourceCell(resource) });
  }
  for (const future of futures) {
    pass.cleanups.push({ owner: instance, run: () => disposeFutureCell(future) });
  }

  instance.endpoints = new Map();
  instance.status = "disposed";
  const ownerCell = instance.ownerCell;
  if (ownerCell !== undefined && ownerCell.child === instance) {
    ownerCell.child = null;
    if (ownerCell.kind === "modelBoundary") {
      ownerCell.failed = false;
      ownerCell.error = undefined;
      ownerCell.failureGeneration += 1;
      ownerCell.retryRequested = false;
    }
  }
  pass.finalizations.push(instance);
}

interface CommitPhaseFailureGroup {
  readonly boundary: ModelBoundaryCell | undefined;
  readonly root: RuntimeModelInstance;
  readonly errors: unknown[];
  processed: boolean;
}

function findCommitPhaseBoundary(owner: RuntimeModelInstance): ModelBoundaryCell | undefined {
  let current = owner;
  while (current.ownerCell !== undefined) {
    const ownerCell = current.ownerCell;
    if (
      ownerCell.kind === "modelBoundary" &&
      !ownerCell.failed &&
      ownerCell.owner.status === "active" &&
      ownerCell.owner.hooks.includes(ownerCell)
    ) return ownerCell;
    current = ownerCell.owner;
  }
  return undefined;
}

function findModelRoot(owner: RuntimeModelInstance): RuntimeModelInstance {
  let root = owner;
  while (root.ownerCell !== undefined) root = root.ownerCell.owner;
  return root;
}

function projectCommitPhaseErrors(errors: readonly unknown[]): unknown {
  if (errors.length === 1) return errors[0];
  return new AggregateError(errors, "Multiple Behavon commit-phase lifecycle errors");
}

function routeCommitPhaseFailures(failures: readonly CommitPhaseFailure[]): void {
  if (failures.length === 0) return;
  const groups: CommitPhaseFailureGroup[] = [];
  const addFailure = ({ owner, error }: CommitPhaseFailure): void => {
    const boundary = findCommitPhaseBoundary(owner);
    const root = findModelRoot(owner);
    let group = groups.find((candidate) =>
      boundary === undefined ? candidate.boundary === undefined && candidate.root === root : candidate.boundary === boundary
    );
    if (group === undefined) {
      group = { boundary, root, errors: [], processed: false };
      groups.push(group);
    }
    group.errors.push(error);
  };
  for (const failure of failures) addFailure(failure);

  let rootFailure: unknown;
  let hasRootFailure = false;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (group.processed) continue;
    group.processed = true;
    const boundary = group.boundary;
    if (boundary !== undefined && !boundary.failed && boundary.owner.status === "active") {
      const child = boundary.child;
      boundary.child = null;
      boundary.failed = true;
      boundary.failureGeneration += 1;
      boundary.retryRequested = false;
      if (child !== null) {
        child.terminalError = projectCommitPhaseErrors(group.errors);
        child.hasTerminalError = true;
        const disposalPass: CommitPhasePass = {
          cleanups: [],
          setups: [],
          failures: [],
          finalizations: [],
        };
        try {
          collectCommitPhaseDisposal(child, disposalPass);
          for (const operation of disposalPass.cleanups) runCommitPhaseOperation(operation, disposalPass);
          // These failures were encountered while applying this Boundary's fallback.
          // Keep them in the same containment cycle even though the Boundary is now
          // marked failed. A later independent failure still searches outward because
          // findCommitPhaseBoundary intentionally skips an already-failed Boundary.
          for (const failure of disposalPass.failures) group.errors.push(failure.error);
        } finally {
          finalizeCommitPhaseInstances(disposalPass);
        }
      }
      boundary.error = projectCommitPhaseErrors(group.errors);
      if (child !== null) child.terminalError = boundary.error;
      scheduleModel(boundary.owner, true);
      continue;
    }

    const disposalPass: CommitPhasePass = {
      cleanups: [],
      setups: [],
      failures: [],
      finalizations: [],
    };
    group.root.terminalError = projectCommitPhaseErrors(group.errors);
    group.root.hasTerminalError = true;
    try {
      collectCommitPhaseDisposal(group.root, disposalPass);
      for (const operation of disposalPass.cleanups) runCommitPhaseOperation(operation, disposalPass);
      for (const failure of disposalPass.failures) group.errors.push(failure.error);
    } finally {
      finalizeCommitPhaseInstances(disposalPass);
    }
    const projected = projectCommitPhaseErrors(group.errors);
    group.root.terminalError = projected;
    if (!hasRootFailure) {
      hasRootFailure = true;
      rootFailure = projected;
    } else {
      const prior = rootFailure instanceof AggregateError ? [...rootFailure.errors] : [rootFailure];
      const next = projected instanceof AggregateError ? [...projected.errors] : [projected];
      rootFailure = projectCommitPhaseErrors([...prior, ...next]);
    }
  }
  if (hasRootFailure) throw rootFailure;
}

function invalidateConnection(record: ConnectionRecord, status: ConnectionRecord["status"]): void {
  if (record.status === "active") activeConnections.delete(record);
  if (record.status === "provisional" || record.status === "active") record.status = status;
}

function disposeInstance(
  instance: RuntimeModelInstance,
  publicCall: boolean,
  deferredFinalizations?: Set<RuntimeModelInstance>,
): void {
  if (instance.status === "disposed" || instance.status === "disposing") {
    if (publicCall) throw new Error(`Behavon Model#${instance.id} dispose() called more than once`);
    return;
  }
  rollbackTransactionRootsOwnedBy(instance);
  instance.status = "disposing";
  const transactionFinalizations = deferredFinalizations ?? (
    currentContext?.transaction.phase === "evaluating"
      ? currentContext.transaction.deferredFinalizations
      : undefined
  );
  scheduledModels.delete(instance);
  instance.scheduled = false;
  instance.independentActivationRequired = false;
  releaseModelObservations(instance);
  invalidateModelObservers(instance);

  for (const record of [...activeConnections]) {
    if (record.owner === instance) invalidateConnection(record, "ownerDisposed");
    else if (
      record.source?.model === instance ||
      record.destination?.model === instance
    ) invalidateConnection(record, "invalid");
  }

  let firstError: unknown;
  let failed = false;
  const capture = (operation: () => void): void => {
    try {
      operation();
    } catch (error: unknown) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  };

  const children: RuntimeModelInstance[] = [];
  const resources: ResourceCell[] = [];
  const futures: FutureCell[] = [];
  for (const hook of instance.hooks) {
    if (hook.kind === "modelBoundary" && hook.child !== null) {
      children.push(hook.child);
    }
    if (hook.kind === "externalStore") {
      hook.generation = hook.nextGeneration;
      hook.nextGeneration += 1;
      const subscription = hook.subscription;
      hook.subscription = undefined;
      if (subscription !== undefined && subscription.status !== "released") {
        subscription.status = "released";
        capture(() => invokeUserFunction("useSyncExternalStore unsubscribe", subscription.unsubscribe));
      }
    } else if (hook.kind === "resource") {
      hook.operationTarget.cleanupWindow = true;
      resources.push(hook);
    } else if (hook.kind === "future") {
      futures.push(hook);
    }
  }

  for (const child of children) {
    capture(() => disposeInstance(child, false, transactionFinalizations));
  }
  for (const hook of instance.hooks) {
    if (hook.kind === "effect" && hook.cleanup !== undefined) {
      capture(() => consumeEffectCleanup(hook, hook.cleanup as EffectCleanupLease));
    }
  }
  for (const resource of resources) capture(() => disposeResourceCell(resource));
  for (const future of futures) capture(() => disposeFutureCell(future));
  for (const hook of instance.hooks) {
    if (hook.kind === "snapshot" && hook.lease.status === "active") {
      hook.lease.status = "released";
      releaseSnapshotOwner(hook.family);
    }
  }

  instance.endpoints = new Map();
  instance.status = "disposed";
  const ownerCell = instance.ownerCell;
  if (ownerCell !== undefined && ownerCell.child === instance) {
    const selfDisposedDuringOwnedEvaluation =
      currentContext?.instance === instance &&
      instance.evaluating &&
      ownerCell.owner.evaluating &&
      currentContext.transaction.drafts.has(ownerCell.owner);
    ownerCell.child = null;
    if (ownerCell.kind === "modelBoundary") {
      ownerCell.failed = false;
      ownerCell.error = undefined;
      ownerCell.failureGeneration += 1;
      ownerCell.retryRequested = false;
    }
    if (ownerCell.owner.status === "active" && !selfDisposedDuringOwnedEvaluation) {
      scheduleModel(ownerCell.owner, true);
    }
  }
  if (transactionFinalizations !== undefined) transactionFinalizations.add(instance);
  else if (currentCommitPhasePass !== undefined) currentCommitPhasePass.finalizations.push(instance);
  else finalizeDisposedInstance(instance);
  if (failed) throw firstError;
}

function transactionStart(
  id: TransactionId,
  lockTargets: readonly StateId<unknown>[],
): void {
  if (currentContext !== undefined) {
    throw new Error("Behavon.transaction.start cannot run while evaluating a Model");
  }
  const identity = requireTransactionIdentity(id, "start");
  const owner = requireTransactionOwner("start");
  const ownerScopes = transactionScopes.get(identity) ?? new WeakMap<RuntimeModelInstance, RuntimeTransactionScope>();
  if (ownerScopes.has(owner)) {
    throw new Error("Behavon.transaction.start cannot reuse a TransactionId in the same Model instance");
  }
  if (!Array.isArray(lockTargets)) {
    throw new Error("Behavon.transaction.start requires an array of StateIds");
  }
  const cells = new Set<StateCell>();
  for (const target of lockTargets) {
    const label = requireStateIdentity(target, "transaction.start");
    const subject = mutableObserver.labeledSubject(owner, label);
    if (subject === undefined) {
      throw new Error("Behavon.transaction.start StateId is not registered by this Model instance");
    }
    cells.add(subject as StateCell);
  }

  const parent = currentTransactionScope;
  if (parent !== undefined && parent.root.status !== "started") {
    throw new Error("Behavon.transaction.start cannot join a completed root transaction");
  }
  const root: RuntimeTransactionRoot = parent?.root ?? {
    status: "started",
    outer: undefined,
    scopes: new Set(),
    lockCounts: new Map(),
  };
  for (const cell of cells) {
    const lockRoot = mutableObserver.lockRoot(cell);
    if (lockRoot !== undefined && lockRoot !== root) {
      throw new Error("Behavon.transaction.start cannot relock a StateId held by another root transaction");
    }
  }

  const scope: RuntimeTransactionScope = {
    identity,
    owner,
    root,
    locks: cells,
    status: "started",
  };
  if (root.outer === undefined) root.outer = scope;
  root.scopes.add(scope);
  for (const cell of cells) {
    mutableObserver.lock(cell, root);
    root.lockCounts.set(cell, (root.lockCounts.get(cell) ?? 0) + 1);
  }
  ownerScopes.set(owner, scope);
  transactionScopes.set(identity, ownerScopes);
  registerTransactionScope(scope);
}

function transactionRun<Value>(id: TransactionId, body: () => Value): Value {
  if (currentContext !== undefined) {
    throw new Error("Behavon.transaction.run cannot run while evaluating a Model");
  }
  const scope = requireOwnedTransactionScope(id, "run");
  if (scope.status !== "started" || scope.root.status !== "started") {
    throw new Error("Behavon.transaction.run requires an active TransactionId");
  }
  if (typeof body !== "function") {
    throw new Error("Behavon.transaction.run requires a function body");
  }
  if (
    currentTransactionScope !== undefined &&
    currentTransactionScope.root !== scope.root
  ) {
    throw new Error("Behavon.transaction.run cannot overlap a different root transaction");
  }
  const previous = currentTransactionScope;
  currentTransactionScope = scope;
  try {
    const result = invokeUserFunction("transaction.run body", body);
    if (isThenable(result)) {
      rollbackTransactionScope(scope);
      throw new Error("Behavon.transaction.run requires a synchronous body");
    }
    return result;
  } catch (error: unknown) {
    if (scope.root.status === "started") rollbackTransactionScope(scope);
    throw error;
  } finally {
    currentTransactionScope = previous;
  }
}

function prepareTransactionalOwners(
  owners: ReadonlySet<RuntimeModelInstance>,
  evaluation: EvaluationTransaction,
): void {
  const prepared = new Set<RuntimeModelInstance>();
  const visiting = new Set<RuntimeModelInstance>();
  const prepare = (owner: RuntimeModelInstance): void => {
    if (prepared.has(owner)) return;
    if (visiting.has(owner)) {
      throw new Error("Behavon transaction cannot commit a cyclic Model observation graph");
    }
    visiting.add(owner);
    for (const target of observationTargets(owner, evaluation)) {
      if (owners.has(target)) prepare(target);
    }
    visiting.delete(owner);
    prepareModel(owner, owner.input, evaluation);
    prepared.add(owner);
  };
  for (const owner of owners) prepare(owner);
}

function commitRuntimeTransactionRoot(root: RuntimeTransactionRoot): void {
  const includedScopes = [...root.scopes].filter((scope) => scope.status !== "rolledback");
  const entries = mutableObserver.transactionEntries(root, includedScopes);
  if (entries.length === 0) {
    for (const scope of includedScopes) scope.status = "committed";
    completeTransactionRoot(root);
    return;
  }

  const owners = new Set<RuntimeModelInstance>();
  const baselines = new Map<StateCell, number>();
  for (const [subject, updates] of entries) {
    const cell = subject as StateCell;
    const inspection = mutableObserver.inspect(cell);
    const owner = inspection.owner as RuntimeModelInstance;
    if (owner.status !== "active") {
      rollbackTransactionRoot(root);
      throw new Error("Behavon transaction cannot commit state owned by a disposed Model");
    }
    owners.add(owner);
    baselines.set(cell, mutableObserver.queuedUpdateCount(cell));
    for (const update of updates) mutableObserver.enqueue(cell, update);
  }
  for (const owner of owners) {
    scheduledModels.delete(owner);
    owner.scheduled = false;
    owner.independentActivationRequired = false;
  }

  const evaluation = createTransaction();
  try {
    try {
      prepareTransactionalOwners(owners, evaluation);
      assertTransactionOwnersCommittable(evaluation);
      commitTransaction(evaluation, () => {
        for (const scope of includedScopes) scope.status = "committed";
        completeTransactionRoot(root);
      });
    } catch (error: unknown) {
      if (evaluation.phase === "committed") throw error;
      abortTransaction(evaluation);
      for (const [cell, baseline] of baselines) {
        mutableObserver.discardSuffix(cell, baseline);
      }
      rollbackTransactionRoot(root);
      const failureOwner = evaluation.failureOwner ?? owners.values().next().value;
      if (failureOwner !== undefined) {
        if (!containModelEvaluationFailure(failureOwner, error)) {
          terminateModelOwnerRoot(failureOwner, error);
        }
      }
      throw error;
    }
  } finally {
    finalizeEvaluationTransaction(evaluation);
  }
}

function transactionCommit(id: TransactionId): void {
  if (currentContext !== undefined) {
    throw new Error("Behavon.transaction.commit cannot run while evaluating a Model");
  }
  const scope = requireCommitTransactionScope(id);
  if (scope.status !== "started" || scope.root.status !== "started") {
    throw new Error("Behavon.transaction.commit requires an active TransactionId");
  }
  if (scope !== scope.root.outer) {
    scope.status = "committed";
    return;
  }
  const unfinished = [...scope.root.scopes].find(
    (candidate) => candidate !== scope && candidate.status === "started",
  );
  if (unfinished !== undefined) {
    throw new Error("Behavon.transaction.commit cannot complete a root with an active nested transaction");
  }
  commitRuntimeTransactionRoot(scope.root);
}

function transactionRollback(id: TransactionId): void {
  if (currentContext !== undefined) {
    throw new Error("Behavon.transaction.rollback cannot run while evaluating a Model");
  }
  const scope = requireOwnedTransactionScope(id, "rollback");
  if (scope.status !== "started" || scope.root.status !== "started") {
    throw new Error("Behavon.transaction.rollback requires an active TransactionId");
  }
  rollbackTransactionScope(scope);
}

export const transaction = Object.freeze({
  start: transactionStart,
  run<Body extends () => unknown>(
    id: TransactionId,
    body: Body & SynchronousTransactionBody<Body>,
  ): ReturnType<Body> {
    return transactionRun(id, body) as ReturnType<Body>;
  },
  commit: transactionCommit,
  rollback: transactionRollback,
}) satisfies TransactionApi;

export function useState<State = undefined>(): readonly [State | undefined, StateSetter<State | undefined>];
export function useState<State>(initial: State | (() => State)): readonly [State, StateSetter<State>];
export function useState<State>(
  initial?: State | (() => State),
): readonly [State | undefined, StateSetter<State | undefined>] {
  return useStateInternal(initial, undefined, "useState");
}

export function useLabelState<State>(
  id: StateId<State>,
  initial: State | (() => State),
): readonly [State, StateSetter<State>] {
  requireContext("useLabelState");
  const label = requireStateIdentity(id, "useLabelState");
  return useStateInternal(initial, label, "useLabelState") as readonly [State, StateSetter<State>];
}

function useStateInternal<State>(
  initial: State | (() => State) | undefined,
  label: object | undefined,
  api: "useState" | "useLabelState",
): readonly [State | undefined, StateSetter<State | undefined>] {
  const context = requireContext(api);
  const existing = activeHook(context, "state") as StateCell | undefined;
  let cell: StateCell;
  if (existing === undefined) {
    cell = {} as StateCell;
    const operationTarget = createRetainedOperationTarget(context.instance, {
      kind: "stateSetter",
      owner: context.instance,
      cell: undefined,
    } as StateOperationTarget);
    const setter: StateSetter<unknown> = (update) => {
      invokeRetainedModelUpdate("useState", operationTarget, update);
    };
    Object.assign(cell, {
      kind: "state" as const,
      owner: context.instance,
      label,
      value: typeof initial === "function"
        ? invokeUserFunction("useState lazy initializer", initial as () => State)
        : initial,
      queue: [],
      setter,
      operationTarget,
    });
    mutableObserver.register(cell, context.instance);
    if (label !== undefined) mutableObserver.registerLabel(cell, context.instance, label);
    operationTarget.cell = cell;
    registerRetainedOperationForTests(setter, operationTarget);
  } else {
    cell = existing;
    if (cell.label !== label) {
      if (cell.label !== undefined && label !== undefined) {
        throw new Error("Behavon.useLabelState StateId changed at the same Hook position");
      }
      throw new Error(
        `Behavon state Hook changed between ${cell.label === undefined ? "useState" : "useLabelState"} and ${api}`,
      );
    }
    if (label !== undefined) mutableObserver.registerLabel(cell, context.instance, label);
  }
  recordStateQueueBaseline(context, cell);
  const progress = context.stateProgress.get(cell) ?? {
    value: mutableObserver.value(cell),
    consumed: 0,
  };
  const consumed = mutableObserver.queuedUpdateCount(cell);
  const value = applyUpdates(
    progress.value,
    mutableObserver.queuedUpdates(cell, progress.consumed, consumed),
    "useState functional updater",
  );
  context.draft.hooks.push({ kind: "state", cell, value, consumed });
  context.hookIndex += 1;
  return [value as State | undefined, cell.setter as StateSetter<State | undefined>];
}

export function useReducer<State, ActionArgs extends ReducerActionArgs>(
  reducer: Reducer<State, ActionArgs>,
  initialState: State,
): readonly [State, ReducerDispatch<ActionArgs>];
export function useReducer<State, InitialArg, ActionArgs extends ReducerActionArgs>(
  reducer: Reducer<State, ActionArgs>,
  initialArg: InitialArg,
  initializer: (initialArg: InitialArg) => State,
): readonly [State, ReducerDispatch<ActionArgs>];
export function useReducer<State, InitialArg, ActionArgs extends ReducerActionArgs>(
  reducer: Reducer<State, ActionArgs>,
  initialArg: InitialArg,
  initializer?: (initialArg: InitialArg) => State,
): readonly [State, ReducerDispatch<ActionArgs>] {
  const context = requireContext("useReducer");
  if (typeof reducer !== "function") {
    throw new Error("Behavon.useReducer requires a reducer function");
  }
  if (initializer !== undefined && typeof initializer !== "function") {
    throw new Error("Behavon.useReducer initializer must be a function when provided");
  }
  const existing = activeHook(context, "reducer") as ReducerCell | undefined;
  let cell: ReducerCell;
  if (existing === undefined) {
    cell = {} as ReducerCell;
    const operationTarget = createRetainedOperationTarget(context.instance, {
      kind: "reducerDispatch",
      owner: context.instance,
      cell: undefined,
    } as ReducerOperationTarget);
    const dispatch: ReducerDispatch<ReducerActionArgs> = (...action) => {
      if (action.length > 1) {
        throw new Error("Behavon.useReducer dispatch accepts zero or one action argument");
      }
      invokeRetainedReducerDispatch(operationTarget, action);
    };
    Object.assign(cell, {
      kind: "reducer" as const,
      owner: context.instance,
      value: initializer === undefined
        ? initialArg
        : invokeUserFunction("useReducer initializer", () => initializer(initialArg)),
      queue: [],
      dispatch,
      operationTarget,
    });
    mutableObserver.register(cell, context.instance);
    operationTarget.cell = cell;
    registerRetainedOperationForTests(dispatch, operationTarget);
  } else {
    cell = existing;
  }
  recordStateQueueBaseline(context, cell);
  const progress = context.stateProgress.get(cell) ?? {
    value: mutableObserver.value(cell),
    consumed: 0,
  };
  const consumed = mutableObserver.queuedUpdateCount(cell);
  let value = progress.value as State;
  for (const action of mutableObserver.queuedUpdates<ReducerActionArgs>(
    cell,
    progress.consumed,
    consumed,
  )) {
    value = invokeUserFunction(
      "useReducer reducer",
      () => reducer(value, ...action as ActionArgs),
    );
  }
  context.draft.hooks.push({ kind: "reducer", cell, value, consumed });
  context.hookIndex += 1;
  return [value, cell.dispatch as ReducerDispatch<ActionArgs>];
}

export function useMutable<State>(initial: State): MutableHandle<State> {
  const context = requireContext("useMutable");
  const existing = activeHook(context, "mutable") as MutableCell | undefined;
  let cell: MutableCell;
  if (existing === undefined) {
    cell = {} as MutableCell;
    const operationTarget = createRetainedOperationTarget(context.instance, {
      kind: "mutableHandle",
      owner: context.instance,
      cell: undefined,
    } as MutableOperationTarget);
    const get = (): State => requireLiveMutableCell(operationTarget).value as State;
    const set = (update: StateUpdate<State>): void => {
      invokeMutableUpdate(operationTarget, update);
    };
    const handle: MutableHandle<State> = Object.freeze({ get, set });
    Object.assign(cell, {
      kind: "mutable" as const,
      owner: context.instance,
      value: initial,
      handle,
      operationTarget,
    });
    operationTarget.cell = cell;
    registerRetainedOperationForTests(get, operationTarget);
    registerRetainedOperationForTests(set, operationTarget);
  } else cell = existing;
  context.draft.hooks.push({ kind: "mutable", cell });
  context.hookIndex += 1;
  return cell.handle as MutableHandle<State>;
}

export function useMemo<Value>(factory: () => Value, dependencies: readonly unknown[]): Value {
  const context = requireContext("useMemo");
  const existing = activeHook(context, "memo") as MemoCell | undefined;
  const previousAttempt = context.previousAttemptHooks?.[context.hookIndex];
  const dependencyLength = dependencies.length;
  if (existing !== undefined) assertDependencyShape(context, "useMemo", existing.dependencyLength, dependencyLength);
  const value = previousAttempt?.kind === "memo"
    ? sameDependencies(previousAttempt.dependencies, dependencies)
      ? previousAttempt.value
      : invokeUserFunction("useMemo factory", factory)
    : existing !== undefined &&
      !context.provisionalHooks.has(existing) &&
      sameDependencies(existing.dependencies, dependencies)
    ? existing.value
    : invokeUserFunction("useMemo factory", factory);
  const cell = existing ?? {
    kind: "memo" as const,
    owner: context.instance,
    value,
    dependencies,
    dependencyLength,
  };
  context.draft.hooks.push({ kind: "memo", cell, value, dependencies });
  context.hookIndex += 1;
  return value as Value;
}

export function useCallback<Callback extends Function>(
  callback: Callback,
  dependencies: readonly unknown[],
): Callback {
  const context = requireContext("useCallback");
  const existing = activeHook(context, "callback") as CallbackCell | undefined;
  const previousAttempt = context.previousAttemptHooks?.[context.hookIndex];
  const dependencyLength = dependencies.length;
  if (existing !== undefined) assertDependencyShape(context, "useCallback", existing.dependencyLength, dependencyLength);
  const version = previousAttempt?.kind === "callback"
    ? sameDependencies(previousAttempt.dependencies, dependencies)
      ? previousAttempt.version
      : createCallbackVersion(context.instance, callback as unknown as UnknownCallback)
    : existing !== undefined &&
      !context.provisionalHooks.has(existing) &&
      sameDependencies(existing.dependencies, dependencies)
    ? existing.version
    : createCallbackVersion(context.instance, callback as unknown as UnknownCallback);
  const cell = existing ?? {
    kind: "callback" as const,
    owner: context.instance,
    version,
    dependencies,
    dependencyLength,
  };
  context.draft.hooks.push({
    kind: "callback",
    cell,
    version,
    dependencies,
  });
  context.hookIndex += 1;
  return version.callable as unknown as Callback;
}

function createManagedCallable(version: CallbackVersion): UnknownCallback {
  return new Proxy(version.callback, {
    apply(_target, receiver, args) {
      return invokeManaged(version, receiver, args);
    },
    construct(_target, args, newTarget) {
      return constructManaged(version, args, newTarget);
    },
  });
}

function createCallbackVersion(owner: RuntimeModelInstance, callback: UnknownCallback): CallbackVersion {
  const version = { provenance: owner.callbackProvenance, owner, callback } as CallbackVersion;
  const callable = createManagedCallable(version);
  Object.assign(version, { callable });
  managedCallbackRecords.set(callable, version);
  return version;
}

export function useEffect(
  effect: () => void | (() => void),
  dependencies?: readonly unknown[],
): void {
  const context = requireContext("useEffect");
  const existing = activeHook(context, "effect") as EffectCell | undefined;
  const dependencyLength = dependencies?.length;
  if (existing !== undefined) assertDependencyShape(context, "useEffect", existing.dependencyLength, dependencyLength);
  const changed = existing === undefined || context.provisionalHooks.has(existing) || dependencies === undefined ||
    !sameDependencies(existing.dependencies as DependencyList, dependencies);
  const cell = existing ?? {
    kind: "effect" as const,
    owner: context.instance,
    effect,
    dependencies,
    dependencyLength,
    cleanup: undefined,
    attempt: undefined,
    nextAttemptGeneration: 1,
  };
  context.draft.hooks.push({ kind: "effect", cell, effect, dependencies, changed });
  context.hookIndex += 1;
}

function createResourceIdentity<Type>(): Type {
  return Object.freeze({}) as Type;
}

const futureDiagnosticListeners = new Set<(diagnostic: FutureDiagnostic) => void>();
export const futureDiagnostics: OccurrenceSource<FutureDiagnostic> = Object.freeze({
  subscribe(listener: (diagnostic: FutureDiagnostic) => void): () => void {
    if (typeof listener !== "function") throw new Error("Behavon.futureDiagnostics.subscribe requires a function");
    futureDiagnosticListeners.add(listener);
    return () => futureDiagnosticListeners.delete(listener);
  },
});

function createFutureChannel<Payload>(target: FutureOperationTarget): FutureOccurrenceChannel<Payload> {
  const listeners = new Set<(payload: Payload) => void>();
  return {
    listeners,
    source: Object.freeze({
      subscribe(listener: (payload: Payload) => void): () => void {
        requireFutureTarget(target, "useFuture occurrence subscription");
        if (typeof listener !== "function") throw new Error("Behavon.useFuture occurrence subscribe requires a function");
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
  };
}

function requireFutureTarget(target: FutureOperationTarget, operation: string): FutureCell {
  const cell = target.cell;
  if (cell === undefined || target.owner === undefined || cell.disposed) {
    throw new Error(`Behavon.useFuture handle requires a live Model instance during ${operation}`);
  }
  return cell;
}

function emitFuture<Payload>(channel: FutureOccurrenceChannel<Payload>, name: string, payload: Payload): void {
  for (const listener of [...channel.listeners]) {
    invokeUserFunction(`useFuture ${name} listener`, () => listener(payload));
  }
}

function emitFutureDiagnostic(diagnostic: FutureDiagnostic): void {
  try {
    for (const listener of [...futureDiagnosticListeners]) {
      invokeUserFunction("useFuture diagnostic listener", () => listener(diagnostic));
    }
  } catch (error: unknown) {
    setTimeout(() => { throw error; }, 0);
  }
}

function createFutureRun(input: unknown): RuntimeFutureRun {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((fulfill, fail) => {
    resolve = fulfill;
    reject = fail;
  });
  return {
    id: Object.freeze({}) as FutureRunId, input, resolve, reject, promise,
    controller: undefined, factory: undefined, phase: "queued", valid: true,
    cancellation: undefined, underlyingSettled: false, completionSettled: false,
    terminalPublicationStarted: false,
  };
}

function futureTransitionSnapshot(transition: FutureTransition): FutureSnapshot<unknown> {
  return transition.snapshot;
}

function requestFutureTransition(
  cell: FutureCell,
  run: RuntimeFutureRun,
  kind: FutureTransition["kind"],
  value?: unknown,
): void {
  if (cell.disposed || cell.operationTarget.owner === undefined) return;
  if (cell.transition !== undefined) throw new Error("Behavon.useFuture attempted overlapping snapshot transitions");
  const snapshot: FutureSnapshot<unknown> = kind === "pending"
    ? Object.freeze({ status: "pending" })
    : kind === "fulfilled"
      ? Object.freeze({ status: "fulfilled", value })
      : Object.freeze({ status: "rejected", reason: value });
  cell.transition = {
    version: cell.nextTransitionVersion,
    run,
    kind,
    value,
    snapshot,
  };
  cell.nextTransitionVersion += 1;
  scheduleModel(cell.owner, true);
}

function reportLateFutureRejection(run: RuntimeFutureRun, error: unknown): void {
  const cancellation = run.cancellation;
  if (cancellation === undefined) return;
  if (
    error === cancellation ||
    (cancellation.cause !== undefined && error === cancellation.cause) ||
    (error instanceof DOMException && error.name === "AbortError")
  ) return;
  emitFutureDiagnostic(Object.freeze({
    type: "late-rejection", run: run.id, input: run.input, cancellation, error,
  }));
}

function normalizedFutureResult(value: unknown): Promise<unknown> {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return Promise.resolve(value);
  let then: unknown;
  try { then = (value as { then?: unknown }).then; }
  catch (error: unknown) { return Promise.reject(error); }
  if (typeof then !== "function") return Promise.resolve(value);
  return new Promise<unknown>((resolve, reject) => {
    try { Reflect.apply(then as Function, value, [resolve, reject]); }
    catch (error: unknown) { reject(error); }
  });
}

function finishFutureUnderlying(cell: FutureCell, run: RuntimeFutureRun, fulfilled: boolean, result: unknown): void {
  run.underlyingSettled = true;
  if (!run.valid || cell.disposed || cell.active !== run) {
    if (!fulfilled) reportLateFutureRejection(run, result);
    return;
  }
  run.valid = false;
  run.phase = "terminal";
  run.controller?.abort(Object.freeze({ type: "behavon-future-terminal-cleanup", run: run.id }));
  requestFutureTransition(cell, run, fulfilled ? "fulfilled" : "rejected", result);
}

function invokeFutureFactory(cell: FutureCell, run: RuntimeFutureRun): void {
  if (!run.valid || run.cancellation !== undefined || cell.disposed || cell.active !== run) return;
  const controller = run.controller as AbortController;
  const context: FutureFactoryContext = Object.freeze({
    signal: controller.signal,
    abort: (reason?: unknown) => cancelFutureRun(cell, run, "self", reason),
  });
  let value: unknown;
  try {
    value = invokeUserFunction("useFuture factory", () => (run.factory as FutureFactory<unknown, unknown>)(run.input, context));
  } catch (error: unknown) {
    finishFutureUnderlying(cell, run, false, error);
    return;
  }
  normalizedFutureResult(value).then(
    (result) => finishFutureUnderlying(cell, run, true, result),
    (error) => finishFutureUnderlying(cell, run, false, error),
  );
}

function startFutureRun(cell: FutureCell, run: RuntimeFutureRun): void {
  if (cell.disposed) return;
  run.phase = "pending";
  run.controller = new AbortController();
  run.factory = cell.factory;
  cell.active = run;
  requestFutureTransition(cell, run, "pending");
}

function startNextFutureRun(cell: FutureCell): void {
  if (cell.disposed || cell.active !== undefined || cell.transition !== undefined) return;
  const next = cell.queue.shift();
  if (next !== undefined) startFutureRun(cell, next);
}

function cancelFutureRun(
  cell: FutureCell,
  run: RuntimeFutureRun,
  kind: FutureCancellationKind,
  cause?: unknown,
): void {
  if (!run.valid || run.phase === "terminal") return;
  const cancellation = new FutureCancellationError(kind, cause);
  run.valid = false;
  run.cancellation = cancellation;
  run.controller?.abort(cancellation);
  if (run.phase === "queued") {
    run.phase = "terminal";
    run.completionSettled = true;
    run.reject(cancellation);
    return;
  }
  run.phase = "terminal";
  if (cell.transition?.run === run && cell.transition.kind === "pending") return;
  requestFutureTransition(cell, run, "rejected", cancellation);
}

function publishFutureTransition(cell: FutureCell, transition: FutureTransition): void {
  if (cell.disposed || cell.transition !== transition) return;
  cell.transition = undefined;
  const run = transition.run;
  if (transition.kind !== "pending") run.terminalPublicationStarted = true;
  let failure: unknown;
  let failed = false;
  try {
    if (transition.kind === "pending") {
      emitFuture(cell.pendingChannel, "pending", Object.freeze({ run: run.id, input: run.input }));
    } else if (transition.kind === "fulfilled") {
      emitFuture(cell.fulfilledChannel, "fulfilled", Object.freeze({ run: run.id, input: run.input, value: transition.value }));
    } else {
      emitFuture(cell.rejectedChannel, "rejected", Object.freeze({ run: run.id, input: run.input, reason: transition.value }));
    }
  } catch (error: unknown) {
    failed = true;
    failure = error;
  }
  if (transition.kind === "pending") {
    if (run.cancellation !== undefined) {
      if (cell.transition === undefined) {
        requestFutureTransition(cell, run, "rejected", run.cancellation);
      }
    }
    else if (failed) {
      run.valid = false;
      run.phase = "terminal";
      run.controller?.abort(Object.freeze({
        type: "behavon-future-pending-listener-failure",
        run: run.id,
      }));
      requestFutureTransition(cell, run, "rejected", failure);
    } else {
      run.phase = "running";
      invokeFutureFactory(cell, run);
    }
  } else {
    run.completionSettled = true;
    if (transition.kind === "fulfilled") run.resolve(transition.value);
    else run.reject(transition.value);
    if (cell.active === run) cell.active = undefined;
    startNextFutureRun(cell);
  }
  if (failed) throw failure;
}

function warnFutureCommand(cell: FutureCell, operation: "start" | "abort"): void {
  warnEvaluationOperation("useFuture command", `'${operation}'`, `future:${cell.owner.id}:${operation}`);
  if (!__BEHAVON_DEVELOPMENT__ || currentTransactionScope === undefined || typeof console === "undefined") return;
  try {
    console.warn(`Behavon.useFuture ${operation}() called inside transaction.run is immediate and nontransactional; rollback will not undo it.`);
  } catch {
    // A development diagnostic must not replace the command result.
  }
}

function futureStart(cell: FutureCell, input: unknown): Promise<unknown> {
  warnFutureCommand(cell, "start");
  const run = createFutureRun(input);
  if (cell.concurrency === "latest") {
    while (cell.queue.length > 0) cancelFutureRun(cell, cell.queue.shift() as RuntimeFutureRun, "superseded");
    if (cell.active !== undefined) {
      cell.queue.push(run);
      cancelFutureRun(cell, cell.active, "superseded");
    } else startFutureRun(cell, run);
  } else {
    cell.queue.push(run);
    startNextFutureRun(cell);
  }
  return run.promise;
}

function futureAbort(cell: FutureCell, reason: unknown): void {
  warnFutureCommand(cell, "abort");
  if (cell.active !== undefined) cancelFutureRun(cell, cell.active, "explicit", reason);
}

function disposeFutureCell(cell: FutureCell): void {
  if (cell.disposed) return;
  cell.disposed = true;
  const active = cell.active;
  cell.active = undefined;
  cell.transition = undefined;
  if (
    active !== undefined &&
    !active.completionSettled &&
    !active.terminalPublicationStarted
  ) {
    const cancellation = new FutureCancellationError("owner-dispose");
    active.valid = false;
    active.cancellation = cancellation;
    active.phase = "terminal";
    active.completionSettled = true;
    active.controller?.abort(cancellation);
    active.reject(cancellation);
  }
  for (const queued of cell.queue.splice(0)) {
    const cancellation = new FutureCancellationError("owner-dispose");
    queued.valid = false;
    queued.cancellation = cancellation;
    queued.phase = "terminal";
    queued.completionSettled = true;
    queued.reject(cancellation);
  }
  cell.pendingChannel.listeners.clear();
  cell.fulfilledChannel.listeners.clear();
  cell.rejectedChannel.listeners.clear();
  cell.operationTarget.cell = undefined;
  cell.operationTarget.owner = undefined;
}

function createFutureCell(
  owner: RuntimeModelInstance,
  factory: FutureFactory<unknown, unknown>,
  concurrency: FutureConcurrency,
): FutureCell {
  const cell = {} as FutureCell;
  const operationTarget = createRetainedOperationTarget(owner, { kind: "future" as const, owner, cell });
  const pendingChannel = createFutureChannel<FuturePendingOccurrence<unknown>>(operationTarget);
  const fulfilledChannel = createFutureChannel<FutureFulfilledOccurrence<unknown, unknown>>(operationTarget);
  const rejectedChannel = createFutureChannel<FutureRejectedOccurrence<unknown>>(operationTarget);
  const future: Future<unknown, unknown> = Object.freeze({
    snapshot: () => {
      const activeCell = requireFutureTarget(operationTarget, "useFuture snapshot");
      const transition = currentContext?.instance === activeCell.owner ? activeCell.transition : undefined;
      return transition === undefined ? activeCell.snapshot : futureTransitionSnapshot(transition);
    },
    start: (input: unknown) => futureStart(requireFutureTarget(operationTarget, "useFuture start"), input),
    abort: (reason?: unknown) => futureAbort(requireFutureTarget(operationTarget, "useFuture abort"), reason),
    pending: pendingChannel.source,
    fulfilled: fulfilledChannel.source,
    rejected: rejectedChannel.source,
  });
  for (const value of [future.snapshot, future.start, future.abort]) registerRetainedOperationForTests(value, operationTarget);
  Object.assign(cell, {
    kind: "future" as const, owner, factory, concurrency,
    snapshot: Object.freeze({ status: "idle" }), future, operationTarget,
    pendingChannel, fulfilledChannel, rejectedChannel,
    active: undefined, queue: [], transition: undefined, nextTransitionVersion: 1, disposed: false,
  });
  return cell;
}

export function useFuture<Input, Value>(
  factory: FutureFactory<Input, Value>,
  options: Readonly<{ concurrency: FutureConcurrency }>,
): Future<Input, Value> {
  const context = requireContext("useFuture");
  if (typeof factory !== "function") throw new Error("Behavon.useFuture requires a factory function");
  if (options?.concurrency !== "serial" && options?.concurrency !== "latest") {
    throw new Error("Behavon.useFuture requires { concurrency: 'serial' | 'latest' }");
  }
  const existing = activeHook(context, "future") as FutureCell | undefined;
  if (existing !== undefined && existing.concurrency !== options.concurrency) {
    throw new Error("Behavon.useFuture concurrency changed at the same Hook position");
  }
  const cell = existing ?? createFutureCell(context.instance, factory as FutureFactory<unknown, unknown>, options.concurrency);
  if (existing === undefined) context.transaction.provisionalFutures.add(cell);
  context.draft.hooks.push({
    kind: "future", cell, factory: factory as FutureFactory<unknown, unknown>,
    snapshot: cell.transition === undefined ? cell.snapshot : futureTransitionSnapshot(cell.transition),
    transitionVersion: cell.transition?.version,
  });
  context.hookIndex += 1;
  return cell.future as Future<Input, Value>;
}

function requireResourceTarget(
  target: ResourceOperationTarget,
  operation: string,
  allowCleanupAbort = false,
): ResourceCell {
  const cell = target.cell;
  const owner = target.owner;
  if (cell === undefined || owner === undefined) {
    throw new Error(`Behavon useResource controller is stale during ${operation}`);
  }
  if (owner.status === "active" || owner.status === "constructing") return cell;
  if (
    allowCleanupAbort &&
    (owner.status === "disposing" || owner.status === "disposed") &&
    target.cleanupWindow
  ) return cell;
  requireLiveInstance(owner, operation);
  return cell;
}

function createResourceChannel(target: ResourceOperationTarget): ResourceOccurrenceChannel {
  const listeners = new Set<(payload: unknown) => void>();
  const source = Object.freeze({
    subscribe(listener: (payload: unknown) => void): () => void {
      if (typeof listener !== "function") throw new TypeError("Behavon Resource occurrence listener must be a function");
      requireResourceTarget(target, "useResource occurrence subscription");
      listeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
      };
    },
  });
  return { source, listeners };
}

function emitResource(cell: ResourceCell, name: string, payload: unknown): void {
  const channel = cell.channels[name];
  if (channel === undefined || cell.disposed) return;
  for (const listener of [...channel.listeners]) {
    invokeUserFunction(`useResource ${name} listener`, () => listener(payload));
  }
}

function setResourceSnapshot(cell: ResourceCell, snapshot: ResourceSnapshot<any>): void {
  cell.snapshot = Object.freeze(snapshot);
  scheduleModel(cell.owner, true);
}

function terminalizeResourceRequests(
  operation: RuntimeResourceOperation | undefined,
  result: ResourceRequestResult,
): void {
  if (operation === undefined) return;
  const frozen = Object.freeze(result);
  for (const request of operation.requests) request.result = frozen;
}

function newResourceRequest(
  command: "open" | "close" | "abort",
  execution: ResourceRequest["execution"],
  operation: RuntimeResourceOperation | undefined,
  initial: ResourceRequestResult = { status: "pending" },
): RuntimeResourceRequest {
  const runtime = {} as RuntimeResourceRequest;
  runtime.result = Object.freeze(initial);
  const id = createResourceIdentity<ResourceRequestId>();
  const publicRequest = Object.freeze({
    id,
    operation: operation?.id,
    command,
    execution,
    getResult: () => runtime.result,
  });
  Object.assign(runtime, { publicRequest });
  return runtime;
}

function resourceDefinition(cell: ResourceCell): ResourceDefinition<any, any, any, any> {
  return resourceDefinitions.get(cell.type as object) as ResourceDefinition<any, any, any, any>;
}

function reportResourceCleanupError(
  cell: ResourceCell,
  error: unknown,
  command: "abort" | "dispose" | "closeFailed",
  reason: unknown,
): void {
  const handler = resourceDefinition(cell).onCleanupError;
  if (handler !== undefined) {
    try {
      invokeUserFunction("useResource cleanup error handler", () => handler(error, Object.freeze({ command, reason })));
      return;
    } catch (handlerError: unknown) {
      error = new AggregateError([error, handlerError], "Behavon Resource cleanup diagnostic failed");
    }
  }
  setTimeout(() => { throw error; }, 0);
}

function settleQueuedAfterClosed(
  cell: ResourceCell,
  queued: RuntimeResourceOperation | undefined,
): void {
  if (
    queued === undefined ||
    cell.disposed ||
    cell.snapshot.phase !== "closed" ||
    cell.operation !== undefined ||
    cell.queued !== queued
  ) return;
  cell.queued = undefined;
  if (queued.kind === "open") {
    queued.priorSnapshot = cell.snapshot;
    cell.token = queued.token;
    cell.operation = queued;
    setResourceSnapshot(cell, { phase: "opening" });
    startResourceOpen(cell, queued);
  } else {
    terminalizeResourceRequests(queued, { status: "succeeded", outcome: "alreadyClosed" });
  }
}

function finishResourceOpen(cell: ResourceCell, operation: RuntimeResourceOperation, resource: unknown): void {
  if (cell.disposed || cell.operation !== operation || cell.token !== operation.token) {
    try {
      const cleanup = invokeUserFunction("useResource abort adapter", () => resourceDefinition(cell).abort({ resource, reason: undefined }));
      if (isPromiseLike(cleanup)) Promise.resolve(cleanup).catch((error) => reportResourceCleanupError(cell, error, "dispose", undefined));
    } catch (error: unknown) {
      reportResourceCleanupError(cell, error, "dispose", undefined);
    }
    return;
  }
  cell.resource = resource;
  cell.operation = undefined;
  cell.actionController = new AbortController();
  setResourceSnapshot(cell, { phase: "open" });
  terminalizeResourceRequests(operation, { status: "succeeded", outcome: "opened" });
  let emissionFailure: unknown;
  try {
    emitResource(cell, "opened", Object.freeze({ operation: operation.id }));
  } catch (error: unknown) {
    emissionFailure = error;
  }
  if (
    !cell.disposed &&
    cell.token === operation.token &&
    cell.snapshot.phase === "open" &&
    cell.operation === undefined &&
    cell.queued?.kind === "close"
  ) startResourceClose(cell, cell.queued);
  if (emissionFailure !== undefined) throw emissionFailure;
}

function failResourceOpen(cell: ResourceCell, operation: RuntimeResourceOperation, error: unknown): void {
  if (cell.disposed || cell.operation !== operation || cell.token !== operation.token) return;
  const queued = cell.queued;
  cell.operation = undefined;
  cell.actionController = undefined;
  setResourceSnapshot(cell, { phase: "closed", closedBy: "openFailed", reason: operation.reason });
  terminalizeResourceRequests(operation, { status: "failed", error });
  let emissionFailure: unknown;
  try {
    emitResource(cell, "openFailed", Object.freeze({ operation: operation.id, error }));
  } catch (reason: unknown) {
    emissionFailure = reason;
  }
  settleQueuedAfterClosed(cell, queued);
  if (emissionFailure !== undefined) throw emissionFailure;
}

function startResourceOpen(cell: ResourceCell, operation: RuntimeResourceOperation): void {
  if (cell.disposed || cell.operation !== operation || cell.token !== operation.token) return;
  try {
    emitResource(cell, "openStarted", Object.freeze({ operation: operation.id }));
  } catch (error: unknown) {
    if (cell.operation === operation) {
      cell.operation = undefined;
      cell.token += 1;
      operation.input = undefined;
      terminalizeResourceRequests(operation, { status: "superseded", by: "open" });
      setResourceSnapshot(cell, operation.priorSnapshot ?? { phase: "closed", closedBy: "initial" });
      if (cell.queued?.kind === "close") {
        terminalizeResourceRequests(cell.queued, { status: "succeeded", outcome: "alreadyClosed" });
        cell.queued = undefined;
      }
    }
    throw error;
  }
  if (cell.disposed || cell.operation !== operation || cell.token !== operation.token) return;
  const controller = new AbortController();
  cell.actionController = controller;
  let value: unknown;
  try {
    value = invokeUserFunction("useResource open adapter", () => resourceDefinition(cell).open({
      input: operation.input,
      signal: controller.signal,
      terminated: (reason: unknown) => resourceTerminated(cell, operation.token, reason),
    }));
    operation.input = undefined;
  } catch (error: unknown) {
    operation.input = undefined;
    failResourceOpen(cell, operation, error);
    return;
  }
  let asynchronous: boolean;
  try {
    asynchronous = isPromiseLike(value);
  } catch (error: unknown) {
    failResourceOpen(cell, operation, error);
    return;
  }
  if (asynchronous) {
    Promise.resolve(value).then(
      (resource) => {
        try { finishResourceOpen(cell, operation, resource); }
        catch (error: unknown) { setTimeout(() => { throw error; }, 0); }
      },
      (error) => {
        try { failResourceOpen(cell, operation, error); }
        catch (failure: unknown) { setTimeout(() => { throw failure; }, 0); }
      },
    );
  } else finishResourceOpen(cell, operation, value);
}

function finishResourceClose(cell: ResourceCell, operation: RuntimeResourceOperation): void {
  if (cell.disposed || cell.operation !== operation || cell.token !== operation.token) return;
  const queued = cell.queued;
  cell.operation = undefined;
  cell.resource = undefined;
  cell.actionController = undefined;
  cell.activeActionsByToken.delete(operation.token);
  setResourceSnapshot(cell, { phase: "closed", closedBy: "close", reason: operation.reason });
  terminalizeResourceRequests(operation, { status: "succeeded", outcome: "closed" });
  let emissionFailure: unknown;
  try {
    emitResource(cell, "closed", Object.freeze({ operation: operation.id, reason: operation.reason }));
  } catch (error: unknown) {
    emissionFailure = error;
  }
  settleQueuedAfterClosed(cell, queued);
  if (emissionFailure !== undefined) throw emissionFailure;
}

function failResourceClose(cell: ResourceCell, operation: RuntimeResourceOperation, error: unknown): void {
  if (cell.disposed || cell.operation !== operation || cell.token !== operation.token) return;
  const queued = cell.queued;
  cell.operation = undefined;
  const resource = cell.resource;
  cell.resource = undefined;
  cell.actionController = undefined;
  cell.activeActionsByToken.delete(operation.token);
  setResourceSnapshot(cell, { phase: "closed", closedBy: "closeFailed", reason: operation.reason });
  terminalizeResourceRequests(operation, { status: "failed", error });
  let emissionFailure: unknown;
  try {
    emitResource(cell, "closeFailed", Object.freeze({ operation: operation.id, error }));
  } catch (reason: unknown) {
    emissionFailure = reason;
  }
  try {
    const cleanup = invokeUserFunction("useResource abort adapter", () => resourceDefinition(cell).abort({ resource, reason: operation.reason }));
    if (isPromiseLike(cleanup)) Promise.resolve(cleanup).catch((reason) => reportResourceCleanupError(cell, reason, "closeFailed", operation.reason));
  } catch (reason: unknown) {
    reportResourceCleanupError(cell, reason, "closeFailed", operation.reason);
  }
  settleQueuedAfterClosed(cell, queued);
  if (emissionFailure !== undefined) throw emissionFailure;
}

function runResourceClose(cell: ResourceCell, operation: RuntimeResourceOperation): void {
  if (cell.disposed || cell.operation !== operation || cell.token !== operation.token) return;
  cell.closeWaitingForActions = false;
  try {
    emitResource(cell, "closeStarted", Object.freeze({ operation: operation.id }));
  } catch (error: unknown) {
    if (cell.operation === operation) {
      cell.operation = undefined;
      terminalizeResourceRequests(operation, { status: "superseded", by: "close" });
      setResourceSnapshot(cell, { phase: "open" });
      if (cell.queued?.kind === "open") {
        terminalizeResourceRequests(cell.queued, { status: "succeeded", outcome: "alreadyOpen" });
        cell.queued.input = undefined;
        cell.queued = undefined;
      }
    }
    throw error;
  }
  if (
    cell.disposed ||
    cell.operation !== operation ||
    cell.token !== operation.token ||
    cell.snapshot.phase !== "closing"
  ) return;
  let value: unknown;
  try {
    value = invokeUserFunction("useResource close adapter", () => resourceDefinition(cell).close({ resource: cell.resource, reason: operation.reason }));
  } catch (error: unknown) {
    failResourceClose(cell, operation, error);
    return;
  }
  let asynchronous: boolean;
  try {
    asynchronous = isPromiseLike(value);
  } catch (error: unknown) {
    failResourceClose(cell, operation, error);
    return;
  }
  if (asynchronous) Promise.resolve(value).then(
    () => {
      try { finishResourceClose(cell, operation); }
      catch (error: unknown) { setTimeout(() => { throw error; }, 0); }
    },
    (error) => {
      try { failResourceClose(cell, operation, error); }
      catch (failure: unknown) { setTimeout(() => { throw failure; }, 0); }
    },
  );
  else finishResourceClose(cell, operation);
}

function startResourceClose(cell: ResourceCell, operation: RuntimeResourceOperation): void {
  if (cell.disposed || cell.token !== operation.token) return;
  if (cell.queued === operation) {
    cell.queued = undefined;
    cell.operation = operation;
  } else if (cell.operation !== operation) return;
  setResourceSnapshot(cell, { phase: "closing" });
  if ((cell.activeActionsByToken.get(operation.token) ?? 0) > 0) {
    cell.closeWaitingForActions = true;
    return;
  }
  runResourceClose(cell, operation);
}

function resourceTerminated(cell: ResourceCell, token: number, reason: unknown): void {
  if (cell.disposed || token !== cell.token) return;
  const operation = cell.operation;
  if (cell.snapshot.phase === "opening" && operation?.kind === "open") {
    failResourceOpen(cell, operation, reason instanceof Error ? reason : new Error("Resource terminated while opening", { cause: reason }));
    return;
  }
  if (cell.snapshot.phase === "closing" && operation?.kind === "close") {
    finishResourceClose(cell, operation);
    return;
  }
  if (cell.snapshot.phase !== "open") return;
  cell.token += 1;
  cell.resource = undefined;
  cell.actionController?.abort(reason);
  cell.actionController = undefined;
  cell.activeActionsByToken.delete(token);
  cell.closeWaitingForActions = false;
  setResourceSnapshot(cell, { phase: "closed", closedBy: "lost", reason });
  emitResource(cell, "lost", Object.freeze({ operation: createResourceIdentity<ResourceOperationId>(), reason }));
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === "object" || typeof value === "function") && value !== null && typeof (value as PromiseLike<unknown>).then === "function";
}

function resourceCommandOpen(cell: ResourceCell): ResourceRequest {
  warnEvaluationOperation("useResource command", "'open'", `resource:${cell.owner.id}:open`);
  let operation: RuntimeResourceOperation;
  let execution: ResourceRequest["execution"];
  if (cell.queued?.kind === "open") {
    operation = cell.queued;
    execution = "coalesced";
  } else if (cell.snapshot.phase === "closed" && cell.queued?.kind === "close") {
    terminalizeResourceRequests(cell.queued, { status: "succeeded", outcome: "alreadyClosed" });
    cell.queued = undefined;
    return resourceCommandOpen(cell);
  } else if (cell.snapshot.phase === "open") {
    const request = newResourceRequest("open", "alreadySatisfied", undefined, { status: "succeeded", outcome: "alreadyOpen" });
    emitResource(cell, "openRequested", Object.freeze({ request: request.publicRequest.id, operation: undefined }));
    return request.publicRequest;
  } else if (cell.operation?.kind === "open" && cell.snapshot.phase === "opening") {
    operation = cell.operation;
    execution = "coalesced";
  } else {
    const queued = cell.snapshot.phase === "closing";
    const priorSnapshot = cell.snapshot;
    operation = {
      id: createResourceIdentity<ResourceOperationId>(),
      kind: "open",
      token: queued ? cell.token + 1 : cell.token + 1,
      reason: undefined,
      requests: [],
      input: cell.input,
      priorSnapshot,
    } as RuntimeResourceOperation & { input: unknown };
    execution = queued ? "queued" : "started";
    if (queued) cell.queued = operation;
    else {
      cell.token = operation.token;
      cell.operation = operation;
      setResourceSnapshot(cell, { phase: "opening" });
    }
  }
  const request = newResourceRequest("open", execution, operation);
  operation.requests.push(request);
  try {
    emitResource(cell, "openRequested", Object.freeze({ request: request.publicRequest.id, operation: operation.id }));
  } catch (error: unknown) {
    if (execution === "started" && cell.operation === operation) {
      cell.operation = undefined;
      cell.token += 1;
      terminalizeResourceRequests(operation, { status: "superseded", by: "open" });
      setResourceSnapshot(cell, operation.priorSnapshot ?? { phase: "closed", closedBy: "initial" });
    }
    throw error;
  }
  if (execution === "started" && cell.operation === operation) startResourceOpen(cell, operation);
  return request.publicRequest;
}

function resourceCommandClose(cell: ResourceCell, reason: unknown): ResourceRequest {
  warnEvaluationOperation("useResource command", "'close'", `resource:${cell.owner.id}:close`);
  if (cell.snapshot.phase === "closed") {
    const request = newResourceRequest("close", "alreadySatisfied", undefined, { status: "succeeded", outcome: "alreadyClosed" });
    emitResource(cell, "closeRequested", Object.freeze({ request: request.publicRequest.id, operation: undefined, reason }));
    return request.publicRequest;
  }
  let operation: RuntimeResourceOperation;
  let execution: ResourceRequest["execution"];
  if (cell.operation?.kind === "close") {
    operation = cell.operation;
    execution = "coalesced";
  } else if (cell.queued?.kind === "close") {
    operation = cell.queued;
    execution = "coalesced";
  } else {
    operation = { id: createResourceIdentity<ResourceOperationId>(), kind: "close", token: cell.token, reason, requests: [] };
    const queued = cell.snapshot.phase === "opening";
    execution = queued ? "queued" : "started";
    if (queued) cell.queued = operation;
    else cell.operation = operation;
  }
  const request = newResourceRequest("close", execution, operation);
  operation.requests.push(request);
  try {
    emitResource(cell, "closeRequested", Object.freeze({ request: request.publicRequest.id, operation: operation.id, reason }));
  } catch (error: unknown) {
    if (execution === "started" && cell.operation === operation) {
      cell.operation = undefined;
      terminalizeResourceRequests(operation, { status: "superseded", by: "close" });
    } else if (execution === "queued" && cell.queued === operation) {
      cell.queued = undefined;
      terminalizeResourceRequests(operation, { status: "superseded", by: "close" });
    }
    throw error;
  }
  if (
    execution === "started" &&
    cell.operation === operation &&
    cell.token === operation.token &&
    cell.snapshot.phase === "open"
  ) startResourceClose(cell, operation);
  return request.publicRequest;
}

function invalidateResource(cell: ResourceCell, reason: unknown, by: "abort" | "dispose"): void {
  const oldOperation = cell.operation;
  const oldQueued = cell.queued;
  const resource = cell.resource;
  const token = cell.token;
  if (oldOperation !== undefined) oldOperation.input = undefined;
  if (oldQueued !== undefined) oldQueued.input = undefined;
  cell.token += 1;
  cell.operation = undefined;
  cell.queued = undefined;
  cell.resource = undefined;
  cell.actionController?.abort(reason);
  cell.actionController = undefined;
  cell.activeActionsByToken.delete(token);
  cell.closeWaitingForActions = false;
  terminalizeResourceRequests(oldOperation, { status: "superseded", by });
  terminalizeResourceRequests(oldQueued, { status: "superseded", by });
  try {
    const cleanup = invokeUserFunction("useResource abort adapter", () => resourceDefinition(cell).abort({ resource, reason }));
    if (isPromiseLike(cleanup)) Promise.resolve(cleanup).catch((error) => reportResourceCleanupError(cell, error, by, reason));
  } catch (error: unknown) {
    reportResourceCleanupError(cell, error, by, reason);
  }
}

function disposeResourceCell(cell: ResourceCell): void {
  if (cell.disposed) return;
  if (cell.snapshot.phase !== "closed" || cell.operation !== undefined || cell.queued !== undefined || cell.resource !== undefined) {
    invalidateResource(cell, undefined, "dispose");
  }
  cell.disposed = true;
  cell.input = undefined;
  for (const channel of Object.values(cell.channels)) channel.listeners.clear();
  cell.operationTarget.cleanupWindow = false;
  cell.operationTarget.cell = undefined;
  cell.operationTarget.owner = undefined;
}

function resourceCommandAbort(cell: ResourceCell, reason: unknown): ResourceRequest {
  warnEvaluationOperation("useResource command", "'abort'", `resource:${cell.owner.id}:abort`);
  if (cell.snapshot.phase === "closed" && cell.queued === undefined) {
    const outcome = cell.snapshot.closedBy === "abort" ? "alreadyAborted" : "alreadyClosed";
    const request = newResourceRequest("abort", "alreadySatisfied", undefined, { status: "succeeded", outcome });
    emitResource(cell, "abortRequested", Object.freeze({ request: request.publicRequest.id, operation: undefined, reason, phase: "closed" }));
    return request.publicRequest;
  }
  const operation = createResourceIdentity<ResourceOperationId>();
  const phase = cell.snapshot.phase;
  const token = cell.token;
  const request = newResourceRequest("abort", "started", { id: operation, kind: "close", token: cell.token, reason, requests: [] }, { status: "succeeded", outcome: "aborted" });
  let requestedFailure: unknown;
  try {
    emitResource(cell, "abortRequested", Object.freeze({ request: request.publicRequest.id, operation, reason, phase }));
  } catch (error: unknown) {
    requestedFailure = error;
  }
  let terminalFailure: unknown;
  if (
    cell.token === token &&
    ((cell.snapshot as ResourceSnapshot<any>).phase !== "closed" || cell.queued !== undefined)
  ) {
    if (phase === "closed") {
      const queued = cell.queued;
      cell.token += 1;
      cell.queued = undefined;
      if (queued !== undefined) queued.input = undefined;
      terminalizeResourceRequests(queued, { status: "superseded", by: "abort" });
    } else {
      invalidateResource(cell, reason, "abort");
    }
    setResourceSnapshot(cell, { phase: "closed", closedBy: "abort", reason });
    try {
      emitResource(cell, "aborted", Object.freeze({ operation, reason, phase }));
    } catch (error: unknown) {
      terminalFailure = error;
    }
  }
  if (requestedFailure !== undefined) throw requestedFailure;
  if (terminalFailure !== undefined) throw terminalFailure;
  return request.publicRequest;
}

function reserveResourceAction(cell: ResourceCell, token: number): void {
  cell.activeActionsByToken.set(token, (cell.activeActionsByToken.get(token) ?? 0) + 1);
}

function releaseResourceAction(cell: ResourceCell, token: number): void {
  const activeActions = cell.activeActionsByToken.get(token);
  if (activeActions !== undefined) {
    if (activeActions <= 1) cell.activeActionsByToken.delete(token);
    else cell.activeActionsByToken.set(token, activeActions - 1);
  }
  if (
    cell.closeWaitingForActions &&
    cell.operation?.kind === "close" &&
    cell.operation.token === token &&
    !cell.activeActionsByToken.has(token)
  ) {
    runResourceClose(cell, cell.operation);
  }
}

function trackResourceAction(
  cell: ResourceCell,
  token: number,
  promise: Promise<unknown>,
): Promise<unknown> {
  return promise.then(
    (value) => {
      if (cell.disposed || cell.token !== token || cell.snapshot.phase === "closed") throw new ResourceActionSupersededError();
      return value;
    },
    (error) => {
      if (cell.disposed || cell.token !== token || cell.snapshot.phase === "closed") throw new ResourceActionSupersededError();
      throw error;
    },
  ).finally(() => releaseResourceAction(cell, token));
}

function invokeResourceAction(cell: ResourceCell, name: string, args: unknown[]): unknown {
  warnEvaluationOperation("useResource action", `'${name}'`, `resource:${cell.owner.id}:action:${name}`);
  if (cell.snapshot.phase !== "open" || cell.actionController === undefined) {
    throw new Error(`Behavon Resource action '${name}' requires an open resource`);
  }
  const token = cell.token;
  const resource = cell.resource;
  const actionController = cell.actionController;
  const action = resourceDefinition(cell).actions?.[name] as AnyResourceAction<unknown>;
  reserveResourceAction(cell, token);
  let result: unknown;
  try {
    result = invokeUserFunction(
      `useResource action '${name}' adapter`,
      () => action({ resource, signal: actionController.signal }, ...args),
    );
  } catch (error: unknown) {
    releaseResourceAction(cell, token);
    throw error;
  }
  if ((typeof result !== "object" && typeof result !== "function") || result === null) {
    releaseResourceAction(cell, token);
    return result;
  }
  let then: unknown;
  try {
    then = (result as { then?: unknown }).then;
  } catch (error: unknown) {
    return trackResourceAction(cell, token, Promise.reject(error));
  }
  if (typeof then !== "function") {
    releaseResourceAction(cell, token);
    return result;
  }
  const normalized = Promise.resolve().then(() => new Promise<unknown>((resolve, reject) => {
    try {
      Reflect.apply(then as Function, result, [resolve, reject]);
    } catch (error: unknown) {
      reject(error);
    }
  }));
  return trackResourceAction(cell, token, normalized);
}

function createResourceCell(
  owner: RuntimeModelInstance,
  type: ResourceType<any, any, any, any>,
  input: unknown,
): ResourceCell {
  const definition = resourceDefinitions.get(type as object);
  if (definition === undefined) throw new Error("Behavon.useResource requires a ResourceType created by Behavon.createResource");
  const cell = {} as ResourceCell;
  const operationTarget = createRetainedOperationTarget(owner, {
    kind: "resourceController" as const,
    owner,
    cell,
    cleanupWindow: false,
  });
  const names = ["openRequested", "openStarted", "opened", "openFailed", "closeRequested", "closeStarted", "closed", "closeFailed", "abortRequested", "aborted", "lost"];
  const channels: Record<string, ResourceOccurrenceChannel> = {};
  for (const name of names) channels[name] = createResourceChannel(operationTarget);
  const controller: Record<string, unknown> = {
    open: () => resourceCommandOpen(requireResourceTarget(operationTarget, "useResource open")),
    close: (reason?: unknown) => resourceCommandClose(requireResourceTarget(operationTarget, "useResource close"), reason),
    abort: (reason?: unknown) => resourceCommandAbort(
      requireResourceTarget(operationTarget, "useResource abort", true),
      reason,
    ),
  };
  for (const name of names) controller[name] = channels[name].source;
  for (const name of Object.keys(definition.actions ?? {})) {
    controller[name] = (...args: unknown[]) => invokeResourceAction(
      requireResourceTarget(operationTarget, `useResource action '${name}'`),
      name,
      args,
    );
  }
  for (const value of Object.values(controller)) {
    if (typeof value === "function") registerRetainedOperationForTests(value, operationTarget);
  }
  Object.assign(cell, {
    kind: "resource" as const,
    owner,
    type,
    input,
    snapshot: Object.freeze({ phase: "closed", closedBy: "initial" }),
    controller: Object.freeze(controller),
    operationTarget,
    channels,
    resource: undefined,
    token: 0,
    operation: undefined,
    queued: undefined,
    actionController: undefined,
    activeActionsByToken: new Map<number, number>(),
    closeWaitingForActions: false,
    disposed: false,
  });
  return cell;
}

export function useResource<
  Input,
  Resource,
  Reason,
  Actions extends ResourceActions<Resource>,
>(
  type: ResourceType<Input, Resource, Reason, Actions>,
  input: Input,
): readonly [ResourceSnapshot<Reason>, ResourceController<Reason, Actions>] {
  const context = requireContext("useResource");
  const existing = activeHook(context, "resource") as ResourceCell | undefined;
  if (existing !== undefined && existing.type !== type) {
    throw new Error("Behavon.useResource ResourceType changed at the same Hook position");
  }
  const cell = existing ?? createResourceCell(context.instance, type, input);
  if (existing === undefined) context.transaction.provisionalResources.add(cell);
  context.draft.hooks.push({ kind: "resource", cell, input });
  context.hookIndex += 1;
  return [cell.snapshot as ResourceSnapshot<Reason>, cell.controller as ResourceController<Reason, Actions>];
}

export function useSyncExternalStore<Snapshot>(
  subscribeFunction: (listener: () => void) => () => void,
  getSnapshotFunction: () => Snapshot,
): Snapshot {
  const context = requireContext("useSyncExternalStore");
  const existing = activeHook(context, "externalStore") as ExternalStoreCell | undefined;
  const value = invokeUserFunction("useSyncExternalStore evaluation getSnapshot", getSnapshotFunction);
  const subscriptionChanged = existing === undefined ||
    context.provisionalHooks.has(existing) ||
    existing.subscribe !== subscribeFunction;
  let cell: ExternalStoreCell;
  if (existing === undefined) {
    const operationTarget = createRetainedOperationTarget(context.instance, {
      kind: "externalStoreListener",
      owner: context.instance,
      cell: undefined,
    } as ExternalStoreOperationTarget);
    cell = {
      kind: "externalStore" as const,
      owner: context.instance,
      subscribe: subscribeFunction,
      getSnapshot: getSnapshotFunction as () => unknown,
      value,
      subscription: undefined,
      generation: 0,
      nextGeneration: 1,
      operationTarget,
    };
    operationTarget.cell = cell;
  } else cell = existing;
  context.draft.hooks.push({
    kind: "externalStore",
    cell,
    subscribe: subscribeFunction,
    getSnapshot: getSnapshotFunction as () => unknown,
    value,
    subscriptionChanged,
  });
  context.hookIndex += 1;
  return value;
}

function registerPortMember(
  context: EvaluationContext,
  port: PortDescriptor<object>,
  name: string,
  expectedKind: RuntimePortMember["kind"],
): RuntimePortMember {
  const descriptor = portDescriptors.get(port);
  if (descriptor === undefined) {
    throw new Error("Behavon Port-aware Hook requires a descriptor created by Behavon.createPort");
  }
  const member = descriptor.members.get(name);
  if (member === undefined) {
    throw new Error(`Behavon Port has no declared member '${name}'`);
  }
  if (member.kind !== expectedKind) {
    throw new Error(
      `Behavon Port member '${name}' is declared as ${member.kind}, not ${expectedKind}`,
    );
  }
  if (context.draft.port !== undefined && context.draft.port !== descriptor) {
    throw new Error("Behavon Model cannot register members from more than one Port declaration");
  }
  context.draft.port = descriptor;
  context.draft.portMembers.add(name);
  return member;
}

function assertPortDeclarationComplete(draft: ModelDraft): void {
  const port = draft.port;
  if (port === undefined) return;
  for (const [name, member] of port.members) {
    if (!draft.portMembers.has(name)) {
      throw new Error(`Behavon Model did not register declared Port member '${name}'`);
    }
    if (member.kind === "snapshot") {
      if (!draft.exports.has(name)) {
        throw new Error(`Behavon Model did not export declared Port snapshot '${name}'`);
      }
      continue;
    }
    const endpoint = draft.endpoints.get(name);
    const matching = member.kind === "signal" ? endpoint?.signals.length : endpoint?.slots.length;
    const conflicting = member.kind === "signal" ? endpoint?.slots.length : endpoint?.signals.length;
    if ((matching ?? 0) === 0 || (conflicting ?? 0) > 0) {
      throw new Error(
        `Behavon Model did not register Port member '${name}' exclusively as ${member.kind}`,
      );
    }
    if (member.kind === "signal" && !draft.exports.has(name)) {
      throw new Error(`Behavon Model did not export declared Port Signal '${name}'`);
    }
  }
  for (const name of draft.endpoints.keys()) {
    if (!port.members.has(name)) {
      throw new Error(`Behavon Model registered undeclared Port endpoint '${name}'`);
    }
  }
  for (const name of draft.exports.keys()) {
    if (!port.members.has(name)) {
      throw new Error(`Behavon Model registered undeclared Port export '${name}'`);
    }
  }
}

function declareEndpoint(
  role: "signal" | "slot",
  name: string,
  callback: UnknownCallback,
  port: PortDescriptor<object>,
): EndpointHandle {
  const context = requireContext(role === "signal" ? "useSignal" : "useSlot");
  requirePortDescriptor(port, role === "signal" ? "useSignal" : "useSlot");
  assertEndpointName(name);
  registerPortMember(context, port, name, role);
  if (context.draft.exports.has(name)) {
    throw new Error(`Behavon public member '${name}' cannot be both an endpoint and an export`);
  }
  const callbackVersion = managedCallbackRecords.get(callback);
  if (callbackVersion === undefined || callbackVersion.provenance !== context.instance.callbackProvenance) {
    throw new Error(`Behavon.use${role === "signal" ? "Signal" : "Slot"} requires a managed callback from the same Model`);
  }
  const existing = activeHook(context, role) as DeclarationCell | undefined;
  if (existing !== undefined && existing.name !== name) {
    throw new Error(`Behavon public endpoint declaration changed from '${existing.name}' to '${name}'`);
  }
  if (existing !== undefined && existing.port !== port) {
    throw new Error(`Behavon public endpoint '${name}' changed its Port declaration`);
  }
  let endpoint = context.draft.endpoints.get(name);
  if (endpoint === undefined) {
    endpoint = { name, order: context.draft.endpoints.size, signals: [], slots: [] };
    context.draft.endpoints.set(name, endpoint);
  }
  if (role === "signal") endpoint.signals.push(callbackVersion);
  else endpoint.slots.push(callbackVersion);
  const handle = existing?.handle ?? getEndpointHandle(context.instance, name, role);
  const cell = existing ?? {
    kind: role,
    owner: context.instance,
    name,
    callback: callbackVersion,
    port,
    handle,
  } as DeclarationCell;
  const declaration: DeclarationDraft = { kind: role, cell, name, callback: callbackVersion };
  context.draft.hooks.push(declaration);
  context.hookIndex += 1;
  return handle;
}

type SignalPortName<Surface extends object> = {
  [Name in keyof Surface]-?: [Surface[Name]] extends [
    { readonly [endpointRole]: { readonly signal: true } }
  ] ? Name : never;
}[keyof Surface] & string;

type SlotPortName<Surface extends object> = {
  [Name in keyof Surface]-?: [Surface[Name]] extends [
    { readonly [endpointRole]: { readonly slot: true } }
  ] ? Name : never;
}[keyof Surface] & string;

type SignalPortArgs<Value> = Value extends Signal<infer Args> ? Args : never;
type SlotPortArgs<Value> = Value extends Slot<infer Args> ? Args : never;

export function useSignal<Surface extends object, Name extends SignalPortName<Surface>, Result>(
  port: PortDescriptor<Surface>,
  name: Name,
  callback: (...args: SignalPortArgs<Surface[Name]>) => Result,
): Surface[Name];
export function useSignal(
  port: PortDescriptor<object>,
  name: string,
  callback: UnknownCallback,
): Signal<readonly unknown[]> {
  return declareEndpoint("signal", name, callback, port).callable as Signal<readonly unknown[]>;
}

export function useSlot<Surface extends object, Name extends SlotPortName<Surface>, Result>(
  port: PortDescriptor<Surface>,
  name: Name,
  callback: (...args: SlotPortArgs<Surface[Name]>) => Result,
): Surface[Name];
export function useSlot(
  port: PortDescriptor<object>,
  name: string,
  callback: UnknownCallback,
): Slot<readonly unknown[]> {
  return declareEndpoint("slot", name, callback, port).callable as Slot<readonly unknown[]>;
}

// Signals, Slots, and exports exist only through a Port declared with createPort.
function requirePortDescriptor(port: unknown, api: "useSignal" | "useSlot" | "useExport"): void {
  if ((typeof port !== "object" && typeof port !== "function") || port === null || !portDescriptors.has(port as PortDescriptor<object>)) {
    throw new Error(`Behavon.${api} requires a Port created by Behavon.createPort as its first argument`);
  }
}

function createExportValue(
  initialize: () => Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const candidate = invokeUserFunction("useExport initializer", initialize);
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Behavon.useExport initializer must return a non-null plain object");
  }
  const prototype = Object.getPrototypeOf(candidate);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Behavon.useExport initializer must return an ordinary object or null-prototype object");
  }
  if (Object.getOwnPropertySymbols(candidate).length > 0) {
    throw new Error("Behavon.useExport does not allow symbol properties");
  }
  const copy = Object.create(null) as Record<string, unknown>;
  for (const name of Object.getOwnPropertyNames(candidate)) {
    const descriptor = Object.getOwnPropertyDescriptor(candidate, name) as PropertyDescriptor;
    if (!descriptor.enumerable) {
      throw new Error(`Behavon.useExport property '${name}' must be enumerable`);
    }
    if (!("value" in descriptor)) {
      throw new Error(`Behavon.useExport property '${name}' must be a data property`);
    }
    if (typeof descriptor.value === "function") {
      throw new Error(`Behavon.useExport property '${name}' must not be a function`);
    }
    if (reservedEndpointNames.has(name)) {
      throw new Error(`Behavon export name is reserved: ${name}`);
    }
    copy[name] = descriptor.value;
  }
  return Object.freeze(copy);
}

type SnapshotPortName<Surface extends object> = {
  [Name in keyof Surface]-?: Surface[Name] extends SnapshotRootId<unknown> ? Name : never;
}[keyof Surface] & string;

export function useExport<Surface extends object, Name extends SnapshotPortName<Surface> | SignalPortName<Surface>>(
  port: PortDescriptor<Surface>,
  name: Name,
): Surface[Name];
export function useExport<Surface extends object, Name extends SnapshotPortName<Surface>>(
  port: PortDescriptor<Surface>,
  name: Name,
  identity: Surface[Name],
): Surface[Name];
export function useExport(
  port: PortDescriptor<object>,
  name: string,
  providedIdentity?: SnapshotRootId<unknown>,
): unknown {
  const context = requireContext("useExport");
  requirePortDescriptor(port, "useExport");
  if (typeof name !== "string") {
    throw new Error("Behavon.useExport requires a declared Port member name");
  }
  if (portDescriptors.get(port)?.members.get(name)?.kind === "signal") {
    return exportPortSignal(context, port, name);
  }
  const member = registerPortMember(context, port, name, "snapshot") as Extract<
    RuntimePortMember,
    { kind: "snapshot" }
  >;
  const existing = activeHook(context, "export") as ExportCell | undefined;
  if (existing !== undefined && (existing.port !== port || existing.portName !== name)) {
    throw new Error("Behavon public export changed its Port declaration");
  }
  const initialize = () => {
    const identity = providedIdentity === undefined ? createId(member.descriptor) : providedIdentity;
    requireSnapshotRootToken(identity, "useExport");
    return { [name]: identity };
  };
  const cell = existing ?? {
    kind: "export" as const,
    owner: context.instance,
    value: createExportValue(initialize),
    port,
    portName: name,
  };
  for (const [name, value] of Object.entries(cell.value)) {
    if (context.draft.exports.has(name)) {
      throw new Error(`Behavon duplicate public export '${name}'`);
    }
    if (context.draft.endpoints.has(name)) {
      throw new Error(`Behavon public member '${name}' cannot be both an endpoint and an export`);
    }
    context.draft.exports.set(name, value);
  }
  context.draft.hooks.push({ kind: "export", cell, value: cell.value });
  context.hookIndex += 1;
  return cell.value[name];
}

// Opens a Port Signal implemented by useSignal: its handle becomes the public export of that name.
function exportPortSignal(context: EvaluationContext, port: PortDescriptor<object>, name: string): unknown {
  registerPortMember(context, port, name, "signal");
  const existing = activeHook(context, "export") as ExportCell | undefined;
  if (existing !== undefined && (existing.port !== port || existing.portName !== name)) {
    throw new Error("Behavon public export changed its Port declaration");
  }
  if ((context.draft.endpoints.get(name)?.signals.length ?? 0) === 0) {
    throw new Error(`Behavon.useExport requires Signal '${name}' to be registered with useSignal first`);
  }
  if (context.draft.exports.has(name)) {
    throw new Error(`Behavon duplicate public export '${name}'`);
  }
  const cell = existing ?? {
    kind: "export" as const,
    owner: context.instance,
    value: Object.freeze({ [name]: getEndpointHandle(context.instance, name).callable }),
    port,
    portName: name,
  };
  context.draft.exports.set(name, cell.value[name]);
  context.draft.hooks.push({ kind: "export", cell, value: cell.value });
  context.hookIndex += 1;
  return cell.value[name];
}

function observationTargets(
  instance: RuntimeModelInstance,
  transaction: EvaluationTransaction,
): readonly RuntimeModelInstance[] {
  const draft = transaction.drafts.get(instance);
  const hooks = draft?.hooks ?? instance.hooks;
  const targets: RuntimeModelInstance[] = [];
  for (const hook of hooks) {
    if (hook.kind === "model") targets.push(hook.target);
  }
  return targets;
}

function assertAcyclicModelObservation(
  owner: RuntimeModelInstance,
  target: RuntimeModelInstance,
  transaction: EvaluationTransaction,
): void {
  if (owner === target) {
    throw new Error(`Behavon.useModel cannot observe its own Model#${owner.id}`);
  }
  const visited = new Set<RuntimeModelInstance>();
  const pending = [target];
  while (pending.length > 0) {
    const current = pending.pop() as RuntimeModelInstance;
    if (current === owner) {
      throw new Error(
        `Behavon.useModel observation cycle detected between Model#${owner.id} and Model#${target.id}`,
      );
    }
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...observationTargets(current, transaction));
  }
}

export function useModel<Input, Output, Port extends object = object>(
  instance: ModelInstance<Input, Output, Port>,
): ModelHandle<Input, Output>;
export function useModel<Input, Output, Port extends object = object>(
  instanceRef: ModelInstance<Input, Output, Port>,
): ModelHandle<Input, Output> {
  const context = requireContext("useModel");
  const target = getInterfaceTarget<RuntimeModelInstance>(instanceRef as object);
  if (target === undefined) throw new Error("Behavon.useModel requires a live Model instance");
  if (
    (target.status === "disposing" || target.status === "disposed") &&
    target.hasTerminalError
  ) throw target.terminalError;
  requireLiveInstance(target, "model observation");
  assertAcyclicModelObservation(context.instance, target, context.transaction);
  const existing = activeHook(context, "model") as ModelObservationCell | undefined;
  const output = context.transaction.drafts.get(target)?.output ?? target.output;
  const cell = existing ?? {
    kind: "model" as const,
    owner: context.instance,
    target,
    output,
  };
  context.draft.hooks.push({ kind: "model", cell, target, output });
  context.hookIndex += 1;
  return [output as Output, target.inputSetter as StateSetter<Input>];
}

function useBoundaryChildInternal<Input, Output>(
  model: Model<Input, Output>,
  inputState: Input,
): BoundaryState<Output> {
  const context = requireContext("boundary Model");
  const existing = activeHook(context, "modelBoundary") as ModelBoundaryCell | undefined;
  let cell: ModelBoundaryCell;
  if (existing === undefined) {
    cell = {} as ModelBoundaryCell;
    const operationTarget = createRetainedOperationTarget(context.instance, {
      kind: "modelBoundaryOperation",
      owner: context.instance,
      cell: undefined,
    } as ModelBoundaryOperationTarget);
    Object.assign(cell, {
      kind: "modelBoundary" as const,
      owner: context.instance,
      model: model as unknown as UnknownModel,
      child: null,
      inputState,
      failed: false,
      error: undefined,
      failureGeneration: 0,
      retryRequested: false,
      result: undefined,
      operationTarget,
    });
    operationTarget.cell = cell;
  } else {
    cell = existing;
    if (cell.model !== (model as unknown as UnknownModel)) {
      throw new Error("Behavon boundary Child Model changed at a mounted internal position");
    }
  }

  const progress = context.modelProgress.get(cell) ?? { inputState: cell.inputState };

  const boundaryProgress = progress.boundary;
  let child = boundaryProgress?.child ?? cell.child;
  let failed = boundaryProgress?.failed ?? cell.failed;
  let error = boundaryProgress?.error ?? cell.error;
  let failureGeneration = boundaryProgress?.failureGeneration ?? cell.failureGeneration;
  const previousResult = boundaryProgress?.result ?? cell.result;
  const previousResultGeneration = boundaryProgress?.failureGeneration ?? cell.failureGeneration;
  const retryRequested = boundaryProgress === undefined && cell.retryRequested;

  if (failed && !retryRequested) {
    child = null;
  } else {
    const shouldCreate = child === null || child.status === "disposed";
    const shouldUpdate = !shouldCreate && !Object.is(inputState, cell.inputState);
    if (shouldCreate || shouldUpdate) {
      const checkpoint = captureEvaluationAttempt(context.transaction);
      const previousCommittedChild = cell.child;
      try {
        if (shouldCreate) {
          child = createModelInstance(model as unknown as UnknownModel, inputState, context.transaction);
          child.ownerCell = cell;
        }
        prepareModel(child as RuntimeModelInstance, inputState, context.transaction);
        assertEvaluationBranchCommittable(context.transaction, checkpoint);
        failed = false;
        error = undefined;
      } catch (reason: unknown) {
        discardFailedEvaluationBranch(context.transaction, checkpoint);
        if (previousCommittedChild !== null) {
          if (previousCommittedChild.status === "active") {
            previousCommittedChild.ownerCell = undefined;
            try {
              disposeInstance(previousCommittedChild, false);
            } catch {
              // The Model evaluation failure remains authoritative over subtree cleanup failures.
            }
          }
          cell.child = null;
        }
        child = null;
        failed = true;
        error = reason;
        failureGeneration += 1;
      }
    }
  }

  let result: BoundaryState<Output>;
  if (failed) {
    if (
      previousResult?.status === "failed" &&
      previousResultGeneration === failureGeneration &&
      Object.is(previousResult.error, error)
    ) result = previousResult as BoundaryState<Output>;
    else {
      const generation = failureGeneration;
      const operationTarget = cell.operationTarget;
      const reset = (): void => {
        assertSetterEvaluationOwner("boundary", operationTarget.owner);
        const activeCell = operationTarget.cell;
        if (
          activeCell === undefined ||
          operationTarget.owner.status !== "active" ||
          !operationTarget.owner.hooks.includes(activeCell) ||
          !activeCell.failed ||
          activeCell.failureGeneration !== generation
        ) return;
        activeCell.retryRequested = true;
        const activeContext = currentContext;
        if (activeContext?.instance === operationTarget.owner) {
          activeContext.renderPhaseUpdateRequested = true;
        } else {
          scheduleModel(operationTarget.owner, true);
        }
      };
      registerRetainedOperationForTests(reset, operationTarget);
      result = { status: "failed", error, reset };
    }
  } else {
    const output = context.transaction.drafts.get(child as RuntimeModelInstance)?.output ?? child?.output;
    result = previousResult?.status === "active" && Object.is(previousResult.output, output)
      ? previousResult as BoundaryState<Output>
      : { status: "active", output: output as Output };
  }

  context.draft.hooks.push({
    kind: "modelBoundary",
    cell,
    model: model as unknown as UnknownModel,
    child,
    inputState,
    failed,
    error,
    failureGeneration,
    result,
  });
  context.hookIndex += 1;

  return result;
}

export function boundary<Input, Output>(
  model: Model<Input, Output>,
): Model<Input, BoundaryState<Output>> {
  function BoundaryModel(input: Input): BoundaryState<Output> {
    return useBoundaryChildInternal(model, input);
  }
  return BoundaryModel;
}

export function usePort<Ref extends ModelRefBase>(ref: Ref): DependencyProxyForRef<Ref>;
export function usePort(ref: InterfaceTarget): unknown {
  const context = requireContext("usePort");
  const instance = getInterfaceTarget<RuntimeModelInstance>(ref as object);
  if (instance === undefined) throw new Error("Behavon.usePort requires a live Model instance");
  requireLiveInstance(instance, "dependency usePort");
  const existing = activeHook(context, "usePort") as UsePortCell | undefined;
  const cell = existing ?? { kind: "usePort" as const, owner: context.instance, target: instance };
  context.draft.hooks.push({ kind: "usePort", cell, target: instance });
  context.hookIndex += 1;
  return instance.dependencyProxy;
}

function resolveEndpointArgument(value: unknown, position: "source" | "destination"): EndpointHandle {
  if (typeof value !== "function") throw new Error(`Behavon.useConnect received an invalid ${position} endpoint`);
  const handle = endpointHandleRecords.get(value);
  if (handle === undefined) throw new Error(`Behavon.useConnect received an invalid ${position} endpoint`);
  if (position === "source" && handle.role === "slot") {
    throw new Error("Behavon.useConnect source must be a Signal handle");
  }
  if (position === "destination" && handle.role === "signal") {
    throw new Error("Behavon.useConnect destination must be a Slot handle");
  }
  requireLiveInstance(handle.model, `${position} connection endpoint '${handle.name}'`);
  if (!endpointView(handle.model).has(handle.name)) {
    throw new Error(`Behavon.useConnect received a missing ${position} endpoint '${handle.name}'`);
  }
  return handle;
}

function createConnectCell(
  owner: RuntimeModelInstance,
  source: EndpointHandle,
  destination: EndpointHandle,
): ConnectCell {
  const publicIdentity = Object.freeze({}) as Connection;
  const record: ConnectionRecord = {
    id: nextConnectionId++,
    order: nextConnectionOrder++,
    owner,
    source,
    destination,
    status: "provisional",
    publicIdentity,
  };
  const disconnect = (): void => {
    if (record.status !== "active") {
      throw new Error(`Behavon connection#${record.id} is already disconnected or stale`);
    }
    invalidateConnection(record, "manual");
  };
  return { kind: "connect", owner, record, disconnect };
}

export function useConnect<Args extends readonly unknown[]>(
  source: Signal<Args>,
  destination: SlotEndpoint<Readonly<Args>>,
): () => void {
  const context = requireContext("useConnect");
  const sourceHandle = resolveEndpointArgument(source, "source");
  const destinationHandle = resolveEndpointArgument(destination, "destination");
  const sourceRecord = endpointView(sourceHandle.model).get(sourceHandle.name) as EndpointRecord;
  if (sourceRecord.signals.length === 0 && typeof console !== "undefined") {
    console.warn(`Behavon connection source '${sourceHandle.name}' has no Signal registration`);
  }
  const destinationRecord = endpointView(destinationHandle.model).get(destinationHandle.name) as EndpointRecord;
  if (destinationRecord.slots.length === 0 && typeof console !== "undefined") {
    console.warn(`Behavon connection destination '${destinationHandle.name}' has no Slot registration`);
  }
  const existing = activeHook(context, "connect") as ConnectCell | undefined;
  const cell = existing === undefined || existing.record.status === "invalid"
    ? createConnectCell(context.instance, sourceHandle, destinationHandle)
    : existing;
  context.draft.hooks.push({
    kind: "connect",
    cell,
    source: sourceHandle,
    destination: destinationHandle,
  });
  context.hookIndex += 1;
  return cell.disconnect;
}

export function useSnapshot<Root extends SnapshotRootId<unknown>>(root: Root): readonly [
  snapshot: SnapshotValue<Root> | undefined,
  publish: SnapshotPublisher<Root>,
] {
  const context = requireContext("useSnapshot");
  const rootMetadata = requireSnapshotPayloadToken(root, "useSnapshot");
  if (!rootMetadata.root) throw new Error("Behavon.useSnapshot requires the root snapshot identity");
  const existing = activeHook(context, "snapshot") as SnapshotCell | undefined;
  if (existing !== undefined && existing.root !== root) {
    const previous = getSnapshotTokenMetadata(existing.root)?.path ?? "unknown";
    throw new Error(`Behavon snapshot declaration changed from '${previous}' to '${rootMetadata.path}'`);
  }
  let cell: SnapshotCell;
  if (existing === undefined) {
    cell = {} as SnapshotCell;
    const sharedLease = context.draft.hooks.find(
      (hook): hook is SnapshotDraft => hook.kind === "snapshot" && hook.root === root,
    )?.cell.lease;
    const lease: SnapshotLease = sharedLease ?? {
      owner: context.instance,
      family: acquireSnapshotFamily(root),
      status: "provisional",
    };
    const publish = ((...args: readonly unknown[]) => {
      if (cell.owner.status === "disposing" || cell.owner.status === "disposed") return;
      if (args.length !== 1 && args.length !== 2) {
        throw new Error("Behavon.useSnapshot publisher expects exactly 1 or 2 arguments");
      }
      const childPublication = args.length === 2;
      const targetOrUpdate = args[0];
      const childUpdate = args[1];
      let node: SnapshotNodeRecord;
      let next: unknown;
      if (childPublication) {
        const targetMetadata = requireSnapshotPayloadToken(targetOrUpdate, "useSnapshot.publish");
        if (targetMetadata.family.root !== cell.root) {
          throw new Error("Behavon.useSnapshot publisher cannot target a different snapshot family");
        }
        if (targetOrUpdate === cell.root) {
          throw new Error("Behavon.useSnapshot publisher uses publish(value) for the root snapshot identity");
        }
        node = getFamilyNode(cell.family, targetOrUpdate as object);
        next = childUpdate;
      } else {
        node = getFamilyNode(cell.family, cell.root);
        next = targetOrUpdate;
      }
      if (!isLiveSnapshotNode(node)) return;
      warnEvaluationOperation(
        "useSnapshot.publish",
        `'${node.path}' owned by Model#${cell.owner.id}`,
        `snapshot:${cell.owner.id}:${node.path}`,
      );
      const previous = node.current;
      const value = typeof next === "function"
        ? invokeUserFunction(
          "useSnapshot functional updater",
          () => (next as (current: unknown) => unknown)(previous),
        )
        : next;
      if (Object.is(previous, value)) return;
      if (publishSnapshot(node, value)) {
        invokeUserFunction(
          "useSnapshot subscriber notification",
          () => notifySnapshotNode(node),
        );
      }
    }) as SnapshotPublisher<SnapshotRootId<unknown>>;
    Object.assign(cell, {
      kind: "snapshot" as const,
      owner: context.instance,
      root,
      family: lease.family,
      lease,
      publish,
    });
    if (sharedLease === undefined) context.transaction.provisionalSnapshots.add(lease);
  } else cell = existing;
  const family = cell.family;
  context.draft.hooks.push({ kind: "snapshot", cell, root, family });
  context.hookIndex += 1;
  const snapshot = getFamilyNode(family, root).current;
  return [snapshot as SnapshotValue<Root> | undefined, cell.publish as SnapshotPublisher<Root>];
}

export function createModel<Input, Output, Port extends object = object>(
  model: Model<Input, Output, Port>,
  initialInput: NoInfer<Input>,
): ModelInstance<Input, Output, Port>;
export function createModel<Input, Output, Port extends object = object>(
  model: Model<Input, Output, Port>,
  initialInput: NoInfer<Input>,
): ModelInstance<Input, Output, Port> {
  if (currentContext !== undefined) {
    throw new Error(
      `Behavon.createModel cannot create an ownerless Model while evaluating Model#${currentContext.instance.id}`,
    );
  }
  const transaction = createTransaction();
  const instance = createModelInstance(model as unknown as UnknownModel, initialInput, transaction);
  try {
    try {
      prepareModel(instance, initialInput, transaction);
      commitTransaction(transaction);
      return instance.ref as ModelInstance<Input, Output, Port>;
    } catch (error: unknown) {
      abortTransaction(transaction);
      for (const staged of transaction.newInstances) {
        if (staged.status === "active") {
          try {
            disposeInstance(staged, false, transaction.deferredFinalizations);
          } catch {
            // Construction rollback preserves the original error.
          }
        } else transaction.deferredFinalizations.add(staged);
      }
      throw error;
    }
  } finally {
    finalizeEvaluationTransaction(transaction);
  }
}

export function subscribe<Id extends SnapshotId<unknown>>(
  id: Id,
): (listener: () => void) => () => void {
  return getLiveSnapshotNode(id).subscribe;
}

export function getSnapshot<Id extends SnapshotId<unknown>>(
  id: Id,
): () => SnapshotValue<Id> | undefined {
  return getLiveSnapshotNode(id).getSnapshot as () => SnapshotValue<Id> | undefined;
}

export function getInterface(
  target: TypedModelRef<object> | DependencyProxy,
): BehavonInterfaceDescriptor;
export function getInterface(
  target: InterfaceTarget,
): BehavonInterfaceDescriptor {
  if ((typeof target !== "object" && typeof target !== "function") || target === null) {
    throw new Error("Behavon.getInterface requires a live Behavon ref or dependency Proxy");
  }
  const instance = getInterfaceTarget<RuntimeModelInstance>(target as object);
  if (instance === undefined) throw new Error("Behavon.getInterface received a non-Behavon target");
  requireLiveInstance(instance, "interface inspection");
  return {
    endpoints: [...instance.endpoints.values()]
      .sort((left, right) => left.order - right.order)
      .map((endpoint) => ({
        name: endpoint.name,
        signalRegistrations: endpoint.signals.length,
        slotRegistrations: endpoint.slots.length,
      })),
  };
}

const Behavon = Object.freeze({
  createId,
  createPort,
  createResource,
  SnapshotType,
  StateType,
  SignalType,
  SlotType,
  useState,
  useLabelState,
  useReducer,
  useMutable,
  useMemo,
  useCallback,
  useEffect,
  useFuture,
  useResource,
  useSyncExternalStore,
  useSignal,
  useSlot,
  useExport,
  useModel,
  boundary,
  usePort,
  useConnect,
  useSnapshot,
  createModel,
  subscribe,
  getSnapshot,
  getInterface,
  transaction,
  futureDiagnostics,
});

export default Behavon;
