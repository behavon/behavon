# Upload queue

Takes several files at once and uploads them one by one, in order.

## What it shows

- `"serial"` of [`useFuture`](../../../docs/en/api/useFuture.md): the next upload starts only after the previous one ends. Only the file whose turn has actually come becomes `pending`.
- Updating each file's status (queued, uploading, done, failed, cancelled) from the `pending`, `fulfilled`, and `rejected` subscriptions
- `abort()` cancels only the file being uploaded now; the waiting files keep going
- When the Model is terminated, the file being uploaded is cancelled and the waiting files never start
- Remembering the next number, which needs no evaluation, with [`useMutable`](../../../docs/en/api/useMutable.md)

## Files

| File | Role |
| --- | --- |
| [upload-queue.ts](./upload-queue.ts) | The `UploadQueue` Model. Its input is an `UploadApi`. |
| [upload-queue-view.tsx](./upload-queue-view.tsx) | File name input, progress, and the cancel and clear buttons. |
| [fake-upload-api.ts](./fake-upload-api.ts) | A test server where you finish uploads by hand. |
| [upload-queue.test.ts](./upload-queue.test.ts) | Checks order, adding in the middle, cancellation, failure, clearing, and termination. |
| [upload-queue-view.test.tsx](./upload-queue-view.test.tsx) | Checks handing over files and their progress on screen. |

## Usage

```tsx
const queue = Behavon.createModel(UploadQueue, api)
root.render(<UploadQueueView queue={queue} />)
// after unmounting the screen
queue.dispose()
```
