# 팀 보드

팀원과 할 일을 따로 관리하고, 선택한 팀원을 새 할 일의 담당자로 지정합니다. 할 일은 서버에 저장합니다.

## 보여 주는 기능

- 여러 Model을 [`createModel`](../../docs/api/createModel.md)로 조립하고 input으로 서로를 넘김
- Members가 Port에 선언하고 공개한 `selected` Signal을 Tasks의 Slot에 [`useConnect`](../../docs/api/useConnect.md)로 연결
- Summary가 Tasks의 결과를 [`useModel`](../../docs/api/useModel.md)로 관찰해 진행률을 계산하는 파생 Model
- 보고(`reportTo`)를 [`useEffect`](../../docs/api/useEffect.md)로 바깥에 알리고, 다음 보고 전과 종료 때 정리 함수 실행
- 서버를 거치는 비동기 명령. 진행 중 여부와 오류를 state로 두고 snapshot으로 보여 줌
- 화면에는 Board 하나만 넘기고, Board가 세 snapshot id를 [`useExport`](../../docs/api/useExport.md)로 다시 공개

## 구성

| 파일 | 역할 |
| --- | --- |
| [members.ts](./members.ts) | `Members`. 팀원 목록과 선택. 선택하면 `selected`로 Tasks에 알립니다. |
| [tasks.ts](./tasks.ts) | `Tasks`. 할 일, 담당자, 진행 중 여부, 오류. 추가와 불러오기는 `TaskTransport`를 거칩니다. |
| [summary.ts](./summary.ts) | `Summary`. Tasks 결과로 전체·완료·진행률을 계산합니다. |
| [board.ts](./board.ts) | `Board`와 조립 함수 `createTeamBoard`. 정리는 만든 순서의 역순입니다. |
| [board-view.tsx](./board-view.tsx) | 팀원·할 일·진행률 컴포넌트. |
| [fake-transport.ts](./fake-transport.ts) | 테스트와 데모용 메모리 서버. 응답을 잡아 두거나 실패시킬 수 있습니다. |
| [team-board.test.ts](./team-board.test.ts) | 담당자 지정, 진행 중·오류, 불러오기, 진행률, 보고 정리, 종료를 확인합니다. |
| [board-view.test.tsx](./board-view.test.tsx) | 화면에서 팀원 선택, 추가, 완료, 진행률을 확인합니다. |

```text
React ──명령──▶ Board ──▶ Members ──selected (Signal)──▶ Tasks.memberSelected (Slot)
                    └───▶ Tasks ──결과──▶ Summary (useModel)
```

## 주의

Signal에 등록된 callback은 마지막으로 평가가 확정된 시점의 값을 씁니다. 팀원을 선택하고 같은 흐름에서 바로 `add`를 부르면, 다시 평가되기 전이라 이전 담당자가 쓰입니다. React의 이벤트 핸들러가 이전 렌더의 값을 쓰는 것과 같습니다.

## 사용

```tsx
const team = createTeamBoard({ members, transport })
root.render(<BoardView board={team.board} />)
// 화면을 내린 뒤
team.dispose()
```

## 상태

완료
