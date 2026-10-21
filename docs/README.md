# Behavon 문서

## 소개

- [시작하기](./getting-started.md)
- [주요 개념](./core-concepts.md)
- [Lint 설정](./lint.md)

서버 렌더링(SSR)과 hydration은 지원하지 않습니다. 자세한 내용은 [지원 범위](./core-concepts.md#지원-범위)를 보세요.

## API

### 기본

- [`createModel()`](./api/createModel.md)
- [`createPort()`](./api/createPort.md)
- [`useModel()`](./api/useModel.md)
- [`boundary()`](./api/boundary.md)
- [`createId()` / `SnapshotType()` / `StateType()`](./api/createId.md)
- [`getInterface()`](./api/getInterface.md)

### 상태

- [`useState()`](./api/useState.md)
- [`useReducer()`](./api/useReducer.md)
- [`useMutable()`](./api/useMutable.md)
- [`useMemo()`](./api/useMemo.md)
- [`useCallback()`](./api/useCallback.md)
- [`useEffect()`](./api/useEffect.md)
- [`useSyncExternalStore()`](./api/useSyncExternalStore.md)

### 명령과 공개

- [`useSignal()`](./api/useSignal.md)
- [`useSlot()`](./api/useSlot.md)
- [`useConnect()`](./api/useConnect.md)
- [`useExport()`](./api/useExport.md)
- [`usePort()`](./api/usePort.md)
- [`useSnapshot()`](./api/useSnapshot.md)
- [`subscribe()` / `getSnapshot()`](./api/subscribe.md)

### 비동기

- [`useFuture()` / `futureDiagnostics`](./api/useFuture.md)
- [`useResource()` / `createResource()`](./api/useResource.md)

### 고급

- [`TypedModelRef`](./api/TypedModelRef.md)
- [`useLabelState()` / `transaction`](./api/transaction.md)
