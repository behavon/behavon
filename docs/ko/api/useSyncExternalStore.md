# `useSyncExternalStore(subscribe, getSnapshot)`

React의 `useSyncExternalStore`와 같습니다. 외부 store의 값을 읽고, 값이 바뀌면 Model을 다시 평가합니다.

```ts
function useSyncExternalStore<Snapshot>(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => Snapshot,
): Snapshot
```

## 인자

- `subscribe`: listener를 등록하고 해제 함수를 반환합니다. 이전과 다른 함수를 넘기면 이전 구독을 해제하고 다시 구독합니다.
- `getSnapshot`: store의 현재 값을 반환합니다. 평가할 때마다 부릅니다.

## 반환값

store의 현재 값.

## 동작

- Model이 종료되면 구독을 해제합니다.
- 서버 렌더링을 지원하지 않으므로 `getServerSnapshot` 인자는 없습니다.

## 예제

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
// 결과값: 지금의 navigator.onLine. online/offline 이벤트가 오면 다시 평가됩니다
```
