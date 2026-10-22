# `useSyncExternalStore(subscribe, getSnapshot)`

The same as React's `useSyncExternalStore`. Reads the value of an external store and evaluates the Model again when it changes.

```ts
function useSyncExternalStore<Snapshot>(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => Snapshot,
): Snapshot
```

## Parameters

- `subscribe`: registers a listener and returns a function that removes it. Passing a different function than before releases the previous subscription and subscribes again.
- `getSnapshot`: returns the store's current value. It is called on every evaluation.

## Returns

The store's current value.

## Behavior

- When the Model is terminated, the subscription is released.
- Server rendering is not supported, so there is no `getServerSnapshot` parameter.

## Example

```ts
const online = {
  subscribe(listener: () => void) {
    window.addEventListener("online", listener)
    window.addEventListener("offline", listener)
    return () => {
      window.removeEventListener("online", listener)
      window.removeEventListener("offline", listener)
    }
  },
  getSnapshot: () => navigator.onLine,
}

function NetworkStatus(): boolean {
  const isOnline = Behavon.useSyncExternalStore(online.subscribe, online.getSnapshot)
  return isOnline
}

const networkStatus = Behavon.createModel(NetworkStatus, undefined)
// result: the current navigator.onLine. Evaluated again on online/offline events
```
