# 데모 앱

위 사례를 한 React 앱에서 골라 봅니다.

## 실행

```sh
# 저장소 루트에서 behavon을 먼저 빌드합니다
npm run build

cd examples
npm install
npm run demo
```

주소창의 `#counter`처럼 사례 id로 바로 열 수 있습니다.

## 보여 주는 기능

- React root 하나에서 사례 전환. 같은 사례를 다시 고르면 Model과 화면을 새로 만듭니다.
- 화면을 먼저 내린 뒤 Model을 정리하는 순서: 다음 사례의 Model을 만들고 `flushSync`로 화면을 바꾼 뒤, 이전 화면이 내려간 것을 확인하고 이전 Model을 `dispose()`
- 바깥 서비스는 브라우저용 가짜(`browser-services.ts`)로 연결. 일정 시간 뒤 응답하고, 취소 신호(`AbortSignal`)가 켜지면 바로 멈춥니다.

## 사례

| 사례 | 해 볼 것 |
| --- | --- |
| 카운터 | +1, -1, +5, 초기화 |
| 할 일 목록 | 추가, 완료, 필터 |
| 팀 보드 | 팀원 선택 뒤 할 일 추가 |
| 검색 | "느림"을 넣고 바로 다른 검색어를 넣으면 이전 검색이 취소됨 |
| 업로드 대기열 | 이름에 "실패"가 들어간 파일은 실패 |
| DB 세션 | 조회는 2초 걸리므로 그 사이에 취소 |
| 견적 요청 | 공급자마다 응답 시간이 다름. "나사"·"볼트"·"와셔"는 공급자 하나씩 공급 불가 |
| 계좌 이체 | 잔액보다 큰 금액을 보내면 전체가 되돌려짐 |
| 거래소 시뮬레이션 | 다음 단계를 누를 때마다 체결과 거부가 바뀜 |

[chat](../chat/)은 실제 WebSocket 서버가 필요하고, [api-server](../api-server/)는 Node 서버라서 넣지 않았습니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| [cases.tsx](./cases.tsx) | 사례 목록. 사례마다 Model과 화면을 만들고 정리하는 방법. |
| [demo-host.tsx](./demo-host.tsx) | `createDemoHost`: React root 하나에서 사례를 바꾸고 정리하는 순서. |
| [browser-services.ts](./browser-services.ts) | 검색·업로드·DB·견적의 브라우저용 가짜 서비스. |
| [main.tsx](./main.tsx), [index.html](./index.html) | 사례 선택 상자와 주소의 `#id` 연결. |
| [vite.config.ts](./vite.config.ts) | `npm run demo`의 설정. |
| [demo-host.test.tsx](./demo-host.test.tsx) | 화면이 내려간 뒤 Model 정리, 같은 사례 다시 시작, 없는 id, 모든 사례를 오류 없이 열고 닫기를 확인합니다. |
| [browser-services.test.ts](./browser-services.test.ts) | 가짜 서비스의 응답과 취소를 확인합니다. |

## 상태

완료
