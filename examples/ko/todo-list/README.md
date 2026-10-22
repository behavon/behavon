# 할 일 목록

할 일을 추가·완료·삭제하고 필터로 걸러 봅니다.

## 보여 주는 기능

- [`useReducer`](../../../docs/ko/api/useReducer.md)로 상태 전이
- [`useMemo`](../../../docs/ko/api/useMemo.md)로 파생 값(남은 개수, 필터 결과)
- [`useSnapshot`](../../../docs/ko/api/useSnapshot.md)의 하위 항목으로 목록·하단·입력 영역을 따로 발행. 입력창에 글자를 쳐도 목록과 하단은 다시 그려지지 않습니다.
- 상태를 가진 Domain과 화면용 값을 만드는 Presenter를 나누고, Domain이 자기 Signal을 Presenter의 Slot에 [`useConnect`](../../../docs/ko/api/useConnect.md)로 연결
- 화면에는 App 하나만 넘기고 Domain과 Presenter는 숨김. App은 명령을 Domain에 전달하고 Presenter의 snapshot id를 [`useExport`](../../../docs/ko/api/useExport.md)의 세 번째 인자로 다시 공개

## 구성

| 파일 | 역할 |
| --- | --- |
| [todo-domain.ts](./todo-domain.ts) | `TodoDomain`. reducer로 상태를 바꾸고, 바뀔 때마다 `changed` Signal로 Presenter에 보냅니다. |
| [todo-presenter.ts](./todo-presenter.ts) | `TodoPresenter`. 받은 상태로 목록·하단·입력 값을 만들고, 값이 바뀐 영역만 발행합니다. |
| [todo-app.ts](./todo-app.ts) | `TodoApp`과 조립 함수 `createTodoList`. 정리는 만든 순서의 역순입니다. |
| [todo-view.tsx](./todo-view.tsx) | 입력·목록·하단 컴포넌트가 각자 자기 snapshot만 구독합니다. |
| [todo-list.test.ts](./todo-list.test.ts) | 명령, 영역별 알림, 숨긴 Model, 정리를 확인합니다. |
| [todo-view.test.tsx](./todo-view.test.tsx) | 화면에서 추가·완료·필터·정리를 확인합니다. |

```text
React ──명령──▶ TodoApp ──명령──▶ TodoDomain
  ▲                                  │ changed (Signal)
  │                                  ▼
  └──── snapshot ◀──── TodoPresenter.show (Slot)
```

## 사용

```tsx
const todos = createTodoList(["우유 사기"])
root.render(<TodoView app={todos.app} />)
// 화면을 내린 뒤
todos.dispose()
```
