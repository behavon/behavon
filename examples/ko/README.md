# Behavon 예제

사용 사례별 예제입니다. 이 디렉터리는 behavon과 별개의 package이며, 배포되는 `behavon` package의 공개 API만 씁니다.

## 실행

```sh
# 저장소 루트에서 behavon을 먼저 빌드합니다
npm run build

cd examples
npm install
npm test
```

`npm test`는 typecheck, [lint](../../docs/ko/lint.md), 예제 테스트를 실행합니다. `npm run demo:ko`는 브라우저에서 사례를 골라 보는 [데모 앱](./demo/)을 엽니다.

## 목록

| 예제 | 보여 주는 기능 |
| --- | --- |
| [counter](./counter/) | state, Port 선언과 `useExport`, React 연결 |
| [todo-list](./todo-list/) | reducer로 상태 전이, 파생 값, 영역별 snapshot, Presenter 분리 |
| [team-board](./team-board/) | 여러 Model 조립, Signal→Slot 연결, 파생 Model, Effect 정리, 비동기 저장 |
| [search](./search/) | `useFuture`의 `latest`, 취소, 진행 상태 표시 |
| [upload-queue](./upload-queue/) | `useFuture`의 `serial`, 순서대로 처리 |
| [chat](./chat/) | `useResource`로 WebSocket 열고 닫기, 끊김 처리 |
| [db-session](./db-session/) | `useResource` action, 진행 중인 query 취소 |
| [quote-request](./quote-request/) | 여러 공급자에게 요청하고 응답 모으기 |
| [bank-transfer](./bank-transfer/) | 여러 Model에 걸친 transaction, 실패 시 되돌리기 |
| [api-server](./api-server/) | HTTP 요청을 Signal로 받아 서비스·저장소로 처리, 종료 순서 |
| [market-simulation](./market-simulation/) | 큰 Model graph, 결정적 재현, transaction |
| [demo](./demo/) | 위 사례를 한 React 앱에서 골라 보기 |

## 공통 규칙

- Model과 Port는 모듈 최상위에 정의합니다.
- 바깥에 공개하는 Signal과 snapshot은 `createPort`로 선언하고 `useExport`로 엽니다.
- React 컴포넌트에는 화면 로직만 둡니다. 상태 계산은 Model에 둡니다.
- React 화면을 먼저 내린 뒤 Model을 `dispose()`합니다.
- 각 예제는 같은 디렉터리의 테스트로 동작을 확인합니다.
