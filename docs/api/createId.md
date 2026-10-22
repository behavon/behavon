# `createId(descriptor?)`

snapshot, state, transaction에 쓸 식별자를 만듭니다.

```ts
function createId(): TransactionId
function createId<T>(descriptor: SnapshotType<T>): SnapshotRootId<T>
function createId(descriptor: { $: SnapshotType<T>, ...children }): SnapshotRootId<T> & children
function createId(descriptor: { [name: string]: StateType<T> }): { [name]: StateId<T> }
```

## 인자

| `descriptor` | 결과 | 쓰는 곳 |
| --- | --- | --- |
| 없음 | `TransactionId` | [`transaction`](./transaction.md) |
| `Behavon.SnapshotType<T>()` | snapshot id | [`useSnapshot`](./useSnapshot.md) |
| `{ $: Behavon.SnapshotType<T>(), child: …, group: { leaf: … } }` | 하위 항목이 있는 snapshot id | [`useSnapshot`](./useSnapshot.md) |
| `{ name: Behavon.StateType<T>() }` | 이름별 `StateId<T>` | [`useLabelState`](./transaction.md) |

`SnapshotType<T>()`와 `StateType<T>()`는 값의 타입만 적는 표시입니다.

## 반환값

바꿀 수 없는(frozen) 식별자 객체.

## 동작

- 부를 때마다 새 식별자입니다. 여러 곳에서 같은 식별자를 쓰려면 모듈 최상위에서 한 번 만듭니다.
- snapshot 묶음에서 `$`가 있는 객체만 값을 담습니다. `$`가 없는 중간 객체(위의 `group`)는 이름을 묶을 뿐입니다.

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
