# Behavon 문서

Behavon은 React Hook 문법으로 React 밖의 상태와 동작을 작성하는 라이브러리입니다.

## 소개

- [시작하기](./getting-started.md): 설치, 첫 Model, React 연결
- [주요 개념](./core-concepts.md): Model, instance, Port, Signal과 Slot, snapshot, 오류와 종료
- [Lint 설정](./lint.md): Hook 규칙 검사

## API

### Model

- [`createModel()`](./api/createModel.md): Model을 실행해 instance를 만듭니다.
- [`createPort()`](./api/createPort.md): Model이 바깥에 내놓을 이름과 타입을 선언합니다.
- [`useModel()`](./api/useModel.md): 다른 instance의 결과값을 읽습니다.
- [`usePort()`](./api/usePort.md): 다른 instance가 내놓은 것을 씁니다.
- [`TypedModelRef`](./api/TypedModelRef.md): instance를 받는 쪽의 타입입니다.
- [`createId()`](./api/createId.md): snapshot·state·transaction 식별자를 만듭니다.
- [`getInterface()`](./api/getInterface.md): instance에 등록된 Signal·Slot을 봅니다.

### 상태

- [`useState()`](./api/useState.md)
- [`useReducer()`](./api/useReducer.md)
- [`useMutable()`](./api/useMutable.md)
- [`useMemo()`](./api/useMemo.md)
- [`useCallback()`](./api/useCallback.md)
- [`useEffect()`](./api/useEffect.md)
- [`useSyncExternalStore()`](./api/useSyncExternalStore.md)

### Signal과 Slot

- [`useSignal()`](./api/useSignal.md): 명령이나 이벤트를 보내는 Signal을 만듭니다.
- [`useSlot()`](./api/useSlot.md): Signal을 받는 Slot을 만듭니다.
- [`useConnect()`](./api/useConnect.md): Signal을 Slot에 연결합니다.
- [`useExport()`](./api/useExport.md): Signal과 snapshot id를 바깥에 엽니다.

### 바깥에 값 보여 주기

- [`useSnapshot()`](./api/useSnapshot.md): 값을 발행합니다.
- [`subscribe()` / `getSnapshot()`](./api/subscribe.md): 발행된 값을 읽습니다.

### 비동기

- [`useFuture()`](./api/useFuture.md): 비동기 작업을 실행하고 상태를 추적합니다.
- [`createResource()` / `useResource()`](./api/useResource.md): 열고 닫는 외부 자원을 관리합니다.

### 고급

- [`useLabelState()` / `transaction`](./api/transaction.md): 여러 state 변경을 한 번에 확정하거나 되돌립니다.
