# 검색

입력할 때마다 검색하고, 아직 끝나지 않은 이전 검색은 취소합니다.

## 보여 주는 기능

- [`useFuture`](../../../docs/ko/api/useFuture.md)의 `"latest"`: 새 검색이 이전 검색을 취소
- 실행마다 받는 취소 신호(`AbortSignal`, factory의 `context.signal`)를 서버 호출에 넘겨, 취소된 요청이 실제로 멈춤
- `pending`·`fulfilled`·`rejected` 구독으로 활동 기록(시작·완료·취소·실패)
- `FutureCancellationError`로 취소와 실패를 구분
- 새 검색이 진행되는 동안 이전 결과를 그대로 보여 줌. 검색어를 비우면 진행 중인 검색을 `abort()`

## 구성

| 파일 | 역할 |
| --- | --- |
| [search.ts](./search.ts) | `Search` Model. input은 `SearchApi`입니다. 상태는 `idle`·`searching`·`done`·`failed`입니다. |
| [search-view.tsx](./search-view.tsx) | 검색창, 상태, 결과, 기록을 보여 줍니다. |
| [fake-search-api.ts](./fake-search-api.ts) | 응답을 직접 보내는 테스트용 서버. 요청마다 받은 취소 신호(`AbortSignal`)가 켜졌는지 확인할 수 있습니다. |
| [search.test.ts](./search.test.ts) | 취소, 기록 순서, 이전 결과 유지, 비운 검색어, 실패, 종료를 확인합니다. |
| [search-view.test.tsx](./search-view.test.tsx) | 화면에서 입력하며 검색하는 흐름을 확인합니다. |

## 사용

```tsx
const search = Behavon.createModel(Search, api)
root.render(<SearchView search={search} />)
// 화면을 내린 뒤
search.dispose() // 진행 중인 요청도 취소됩니다
```
