# Behavon documentation

Behavon is a library for writing state and behavior outside React with React Hook syntax.

## Introduction

- [Getting started](./getting-started.md): installation, a first Model, connecting to React
- [Core concepts](./core-concepts.md): Model, instance, Port, Signal and Slot, snapshot, errors and termination
- [Lint setup](./lint.md): checking the Hook rules

## API

### Model

- [`createModel()`](./api/createModel.md): runs a Model and creates an instance.
- [`createPort()`](./api/createPort.md): declares the names and types a Model exposes.
- [`useModel()`](./api/useModel.md): reads another instance's result.
- [`usePort()`](./api/usePort.md): uses what another instance exposes.
- [`TypedModelRef`](./api/TypedModelRef.md): the type for receiving an instance.
- [`createId()`](./api/createId.md): creates snapshot, state, and transaction identifiers.
- [`getInterface()`](./api/getInterface.md): lists the Signals and Slots registered on an instance.

### State

- [`useState()`](./api/useState.md)
- [`useReducer()`](./api/useReducer.md)
- [`useMutable()`](./api/useMutable.md)
- [`useMemo()`](./api/useMemo.md)
- [`useCallback()`](./api/useCallback.md)
- [`useEffect()`](./api/useEffect.md)
- [`useSyncExternalStore()`](./api/useSyncExternalStore.md)

### Signal and Slot

- [`useSignal()`](./api/useSignal.md): creates a Signal that sends a command or an event.
- [`useSlot()`](./api/useSlot.md): creates a Slot that receives a Signal.
- [`useConnect()`](./api/useConnect.md): connects a Signal to a Slot.
- [`useExport()`](./api/useExport.md): opens Signals and snapshot ids to the outside.

### Showing values outside

- [`useSnapshot()`](./api/useSnapshot.md): publishes a value.
- [`subscribe()` / `getSnapshot()`](./api/subscribe.md): reads a published value.

### Async

- [`useFuture()`](./api/useFuture.md): runs async work and tracks its state.
- [`createResource()` / `useResource()`](./api/useResource.md): manages an external resource that is opened and closed.

### Advanced

- [`useLabelState()` / `transaction`](./api/transaction.md): commits or rolls back several state changes at once.
