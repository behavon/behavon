# 업로드 대기열

파일 여러 개를 한 번에 맡기면 하나씩 차례로 올립니다.

## 보여 주는 기능

- [`useFuture`](../../../docs/ko/api/useFuture.md)의 `"serial"`: 앞 업로드가 끝나야 다음 업로드를 시작. 실제로 차례가 온 파일만 `pending`이 됩니다.
- `pending`·`fulfilled`·`rejected` 구독으로 파일마다 상태(대기·업로드 중·완료·실패·취소) 갱신
- `abort()`는 지금 올리는 파일만 취소하고, 기다리던 파일은 계속 올라감
- Model이 종료되면 올리는 중인 파일은 취소되고, 기다리던 파일은 시작하지 않음
- [`useMutable`](../../../docs/ko/api/useMutable.md)로 다시 평가할 필요 없는 다음 번호 기억

## 구성

| 파일 | 역할 |
| --- | --- |
| [upload-queue.ts](./upload-queue.ts) | `UploadQueue` Model. input은 `UploadApi`입니다. |
| [upload-queue-view.tsx](./upload-queue-view.tsx) | 파일 이름 입력, 진행 상황, 취소·지우기 버튼. |
| [fake-upload-api.ts](./fake-upload-api.ts) | 업로드를 직접 끝내는 테스트용 서버. |
| [upload-queue.test.ts](./upload-queue.test.ts) | 순서, 중간 추가, 취소, 실패, 지우기, 종료를 확인합니다. |
| [upload-queue-view.test.tsx](./upload-queue-view.test.tsx) | 화면에서 파일을 맡기고 진행 상황을 확인합니다. |

## 사용

```tsx
const queue = Behavon.createModel(UploadQueue, api)
root.render(<UploadQueueView queue={queue} />)
// 화면을 내린 뒤
queue.dispose()
```
