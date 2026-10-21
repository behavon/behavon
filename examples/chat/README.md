# 채팅

WebSocket으로 채팅방에 접속해 메시지를 주고받습니다. 연결이 끊기면 이유를 보여 주고 다시 연결할 수 있습니다.

## 보여 주는 기능

- [`createResource`](../../docs/api/useResource.md)로 WebSocket 정의
  - `open`: 연결이 열리면 끝나는 Promise. 연결 중에 취소되면 소켓을 닫습니다.
  - 연결된 뒤 서버가 끊으면 `terminated(reason)` → snapshot의 `closedBy`가 `"lost"`
  - `close`는 닫힘을 기다리고, `abort`는 바로 닫습니다.
  - action `send`와 `listen`. `listen`은 메시지 listener를 붙이고 해제 함수를 반환합니다.
- [`useResource`](../../docs/api/useResource.md)의 snapshot으로 연결 상태 표시
- 연결된 동안에만 [`useEffect`](../../docs/api/useEffect.md)에서 `listen`하고, 정리 함수로 해제
- Model이 종료되면 소켓을 닫음. 연결 중이어도 닫힙니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| [chat-socket.ts](./chat-socket.ts) | `ChatSocket` Resource. |
| [chat.ts](./chat.ts) | `Chat` Model. input은 접속 주소와 보낼 때 붙일 이름입니다. |
| [chat-view.tsx](./chat-view.tsx) | 연결 상태, 메시지 목록, 입력창, 나가기·다시 연결 버튼. |
| [fake-web-socket.ts](./fake-web-socket.ts) | 서버 쪽 동작(수락·메시지·끊기)을 테스트가 일으키는 WebSocket 대역. |
| [chat.test.ts](./chat.test.ts) | 연결, 수신, 전송, 나가기·다시 연결, 끊김, 연결 실패, 종료를 확인합니다. |
| [chat-view.test.tsx](./chat-view.test.tsx) | 화면에서 연결, 수신, 전송, 끊김 표시를 확인합니다. |

## 사용

```tsx
const chat = Behavon.createModel(Chat, { url: "wss://chat.example/room", name: "김" })
root.render(<ChatView chat={chat} />)
// 화면을 내린 뒤
chat.dispose()
```

## 상태

완료
