# DB 세션

DB 세션을 열고 금액 조건으로 주문을 조회합니다. 진행 중인 조회를 취소하거나, 조회가 끝난 뒤 세션을 닫을 수 있습니다.

## 구성 요소

```text
OrdersReport (Model) → DbSession (Resource) → DB driver (JS 라이브러리) → DB 서버
```

- **DB 서버**: PostgreSQL 같은 별도 프로그램입니다. 네트워크 메시지만 이해합니다.
- **DB driver**: 우리 프로그램 안에서 실행되는 자바스크립트 라이브러리입니다. 함수 호출을 DB 서버에 보낼 네트워크 메시지로 바꿉니다. 이 예제의 `DatabaseDriver`·`Connection`은 실제 라이브러리가 아니라 예제가 정한 최소 인터페이스이고, 실제 라이브러리는 이 모양에 맞게 감싸서 씁니다.
- **취소 신호(`AbortSignal`)**: 자바스크립트 표준 객체입니다. DbSession은 query를 부를 때 이 객체를 driver 함수의 인자로 넘깁니다. 신호가 켜졌을 때 DB 서버에 취소 메시지를 보낼지, 연결을 끊을지는 driver 라이브러리가 정합니다.
- **driver 조건**: 이 예제는 취소 신호를 지원하는 driver를 씁니다. `Connection.query`는 신호가 켜지면 반환한 Promise를 끝내야 합니다. 지원하지 않는 라이브러리는 감싸는 코드에서 이 조건을 맞춰야 합니다.

## 보여 주는 기능

- [`createResource`](../../docs/api/useResource.md)로 DB 세션 정의. 연결 객체를 만드는 driver는 input으로 받습니다.
- action `query`가 Promise를 반환하고, 세션이 가진 취소 신호(`AbortSignal`, action의 `context.signal`)를 driver에 넘김
- 취소는 세션 `abort()`. 그 세션의 query는 driver가 늦게 응답해도 `ResourceActionSupersededError`로 끝나므로 결과가 화면에 나오지 않습니다.
- 정상 `close()`는 진행 중인 query가 끝난 뒤 닫힘. 닫는 동안 새 query는 실행되지 않습니다.
- 다시 연결한 뒤 새 조회

## 구성

| 파일 | 역할 |
| --- | --- |
| [db-session.ts](./db-session.ts) | `DbSession` Resource와 driver 타입(`DatabaseDriver`, `Connection`). |
| [orders-report.ts](./orders-report.ts) | `OrdersReport` Model. 명령은 `run`·`cancel`·`close`·`connect`입니다. |
| [orders-report-view.tsx](./orders-report-view.tsx) | 연결 상태, 조회 폼, 취소·닫기·다시 연결 버튼, 결과 표. |
| [fake-database.ts](./fake-database.ts) | 연결과 query를 직접 끝내는 테스트용 driver. `ignoresAbort`로 취소를 무시하는 driver도 흉내 냅니다. |
| [orders-report.test.ts](./orders-report.test.ts) | 연결, 조회, 중복 실행, 실패, 취소, 늦은 응답, 닫기, 종료를 확인합니다. |
| [orders-report-view.test.tsx](./orders-report-view.test.tsx) | 화면에서 조회와 취소를 확인합니다. |

## 주의

- 비동기 callback에서 `await` 뒤에는 Model이 이미 종료됐을 수 있습니다. 종료된 Model의 [`useMutable`](../../docs/api/useMutable.md) handle을 쓰면 오류입니다. 여기서는 세션이 abort되면 query가 `ResourceActionSupersededError`로 끝나는 점을 이용해, 그 오류를 받으면 아무것도 건드리지 않고 반환합니다. `useState` setter는 종료 뒤에 불러도 아무 일도 일어나지 않습니다.
## 사용

```tsx
const report = Behavon.createModel(OrdersReport, { url: "postgres://shop", driver })
root.render(<OrdersReportView report={report} />)
// 화면을 내린 뒤
report.dispose() // 연결을 바로 닫습니다
```

## 상태

완료
