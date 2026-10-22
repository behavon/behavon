# 회원 API 서버

가입·로그인·내 정보 조회를 처리하는 HTTP 서버입니다. Node 내장 `node:http`만 씁니다.

## 보여 주는 기능

- HTTP 요청을 요청 객체(`input`, `reply`, `reject`)로 바꿔 공개 Signal(`Gateway`)로 보내고, 연결된 서비스 Slot(`UserService`)이 응답
- Signal은 값을 반환하지 않으므로, 응답은 요청 객체의 `reply`·`reject`로 받음. 처음 온 응답만 쓰고 그 뒤의 응답은 버립니다.
- 각 Signal을 서비스 Slot 하나에만 연결(`Routes`)해서, 요청마다 응답하는 쪽이 하나
- 오류 격리: Slot이 던진 오류는 Signal을 부른 HTTP adapter로 돌아오므로 그 요청만 500으로 끝나고 서버는 계속 동작. 아무도 응답하지 않으면 503.
- 종료 순서: HTTP 서버가 새 요청을 받지 않게 하고 진행 중인 요청이 끝나길 기다린 뒤, `Routes` → `Gateway` → `UserService` → 저장소 순서로 해제

## API

| Method | Path | 인증 | 입력 | 성공 |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | 없음 | 없음 | `200` |
| `POST` | `/users` | 없음 | `email`, `password`(8자 이상), `name` | `201`, 사용자 |
| `POST` | `/sessions` | 없음 | `email`, `password` | `200`, `token`과 사용자 |
| `GET` | `/me` | `Authorization: Bearer <token>` | 없음 | `200`, 사용자 |

실패는 `{ error: { code, message } }`입니다. 잘못된 입력 `400`, 인증 실패 `401`, 이미 가입한 이메일 `409`, 처리 중 오류 `500`, 응답 시간 초과 `503`. 비밀번호가 틀린 경우와 없는 이메일은 같은 응답입니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| [contracts.ts](./contracts.ts) | 요청 객체(`ApiRequest`), 실패(`ApiFailure`), 사용자 타입, `GatewayPort`. |
| [application.ts](./application.ts) | `Gateway`·`Routes` Model과 조립 함수 `createApplication`. |
| [user-service.ts](./user-service.ts) | `UserService` Model. 가입·로그인·내 정보 Slot. |
| [user-store.ts](./user-store.ts) | 메모리 저장소. 실제 서버라면 DB가 들어갈 자리입니다. |
| [security.ts](./security.ts) | `scrypt` 비밀번호 hash와 token 생성. |
| [http.ts](./http.ts) | HTTP 요청을 Signal 호출로 바꾸는 handler. |
| [server.ts](./server.ts) | `startServer`: 서버 시작과 순서대로 종료. |
| [application.test.ts](./application.test.ts) | HTTP 없이 Signal로 가입·로그인·조회, 중복, 잘못된 입력, 인증을 확인합니다. 요청마다 응답이 하나인지도 확인합니다. |
| [server.test.ts](./server.test.ts) | 실제 HTTP로 흐름과 상태 코드, Slot 오류의 500, 시간 초과의 503, 첫 응답 우선, 진행 중 요청을 마친 뒤 종료를 확인합니다. |

## 주의

- 오류 격리는 Signal을 부르는 쪽(HTTP adapter)에서 합니다.
- 비동기 작업(`scrypt`)이 끝나기 전에 시간 초과로 응답했다면, 작업은 계속 진행되고 늦은 응답은 버려집니다. 이미 시작한 저장은 되돌리지 않습니다.
- 예제입니다. session 만료, 로그아웃, 요청 수 제한, TLS 등은 다루지 않습니다.

## 사용

```ts
const server = await startServer({ port: 3000 })
// server.url로 요청
await server.stop() // 진행 중인 요청을 마친 뒤 Model과 저장소를 해제합니다
```

## 상태

완료
