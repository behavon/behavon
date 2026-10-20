# `createId` / `SnapshotType` / `StateType`

식별자를 만듭니다. 넘기는 인자에 따라 만드는 식별자가 다릅니다.

```ts
function createId(): TransactionId
function createId<T>(descriptor: SnapshotType<T>): SnapshotRootId<T>
function createId(descriptor: { $: SnapshotType<T>, ...children }): SnapshotRootId<T> & children
function createId(descriptor: { [name: string]: StateType<T> }): { [name]: StateId<T> }
```

| 호출 | 결과 | 쓰는 곳 |
| --- | --- | --- |
| `createId()` | `TransactionId` | [`transaction`](./transaction.md) |
| `createId(Behavon.SnapshotType<T>())` | 하위 항목 없는 snapshot id | [`useSnapshot`](./useSnapshot.md) |
| `createId({ $: Behavon.SnapshotType<T>(), child: Behavon.SnapshotType<U>(), group: { leaf: … } })` | 하위 항목이 있는 snapshot id | [`useSnapshot`](./useSnapshot.md) |
| `createId({ name: Behavon.StateType<T>() })` | 이름별 `StateId<T>` | [`useLabelState`](./transaction.md) |

- `SnapshotType<T>()`와 `StateType<T>()`는 값의 타입만 적는 표시입니다. 처음 값이나 검사 기능은 없습니다.
- Snapshot 묶음에서 `$`가 있는 객체만 값을 담는 항목입니다. `$`가 없는 중간 객체(위의 `group`)는 이름을 묶을 뿐이라 발행하거나 읽을 수 없습니다.
- 반환된 식별자 객체는 얼어 있어(frozen) 바꿀 수 없습니다.
- 같은 descriptor로 두 번 만들면 서로 다른 식별자입니다. Model 사이에서 공유하려면 모듈 최상위에서 한 번 만듭니다.

## 예제

```ts
const transactionId = Behavon.createId()
const count = Behavon.createId(Behavon.SnapshotType<number>())
const app = Behavon.createId({
  $: Behavon.SnapshotType<{ readonly title: string }>(),
  user: Behavon.SnapshotType<string>(),
  settings: { theme: Behavon.SnapshotType<"light" | "dark">() },
})
const states = Behavon.createId({ balance: Behavon.StateType<number>() })

void [transactionId, count, app.user, app.settings.theme, states.balance]
```
