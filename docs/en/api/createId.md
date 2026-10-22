# `createId(descriptor?)`

Creates identifiers for snapshots, states, and transactions.

```ts
function createId(): TransactionId
function createId<T>(descriptor: SnapshotType<T>): SnapshotRootId<T>
function createId(descriptor: { $: SnapshotType<T>, ...children }): SnapshotRootId<T> & children
function createId(descriptor: { [name: string]: StateType<T> }): { [name]: StateId<T> }
```

## Parameters

| `descriptor` | Result | Used by |
| --- | --- | --- |
| none | `TransactionId` | [`transaction`](./transaction.md) |
| `Behavon.SnapshotType<T>()` | a snapshot id | [`useSnapshot`](./useSnapshot.md) |
| `{ $: Behavon.SnapshotType<T>(), child: …, group: { leaf: … } }` | a snapshot id with children | [`useSnapshot`](./useSnapshot.md) |
| `{ name: Behavon.StateType<T>() }` | a `StateId<T>` per name | [`useLabelState`](./transaction.md) |

`SnapshotType<T>()` and `StateType<T>()` only mark the type of the value.

## Returns

A frozen identifier object.

## Behavior

- Every call creates a new identifier. To share one identifier, create it once at module top level.
- In a snapshot group, only objects with `$` hold values. An intermediate object without `$` (the `group` above) only groups names.

## Example

```ts
const transactionId = Behavon.createId()
const count = Behavon.createId(Behavon.SnapshotType<number>())
const app = Behavon.createId({
  $: Behavon.SnapshotType<{ readonly title: string }>(),
  user: Behavon.SnapshotType<string>(),
  settings: { theme: Behavon.SnapshotType<"light" | "dark">() },
})
const states = Behavon.createId({ balance: Behavon.StateType<number>() })

void [transactionId, count, app.user, app.settings.theme, states.balance]
```
