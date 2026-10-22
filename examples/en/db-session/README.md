# DB session

Opens a DB session and queries orders by a minimum total. A query in progress can be cancelled, and the session can be closed after a query ends.

## Parts

```text
OrdersReport (Model) → DbSession (Resource) → DB driver (JS library) → DB server
```

- **DB server**: a separate program such as PostgreSQL. It only understands network messages.
- **DB driver**: a JavaScript library running inside our program. It turns function calls into network messages for the DB server. The `DatabaseDriver` and `Connection` of this example are not a real library but a minimal interface the example defines; a real library is wrapped to fit this shape.
- **Cancellation signal (`AbortSignal`)**: a standard JavaScript object. DbSession passes it as an argument of the driver function when it calls a query. Whether to send a cancel message to the DB server or drop the connection when the signal turns on is up to the driver library.
- **Driver requirement**: this example uses a driver that supports the cancellation signal. `Connection.query` must end the Promise it returned once the signal turns on. For a library without that support, the wrapping code has to meet this requirement.

## What it shows

- Defining the DB session with [`createResource`](../../../docs/en/api/useResource.md). The driver that creates connections is received as input.
- The action `query` returns a Promise and passes the session's cancellation signal (`AbortSignal`, the action's `context.signal`) to the driver
- Cancelling is the session's `abort()`. That session's queries end with `ResourceActionSupersededError` even if the driver answers late, so their results never reach the screen.
- A normal `close()` closes after the query in progress ends. New queries do not run while it closes.
- Reconnecting and querying again

## Files

| File | Role |
| --- | --- |
| [db-session.ts](./db-session.ts) | The `DbSession` Resource and the driver types (`DatabaseDriver`, `Connection`). |
| [orders-report.ts](./orders-report.ts) | The `OrdersReport` Model. Its commands are `run`, `cancel`, `close`, and `connect`. |
| [orders-report-view.tsx](./orders-report-view.tsx) | Connection state, query form, the cancel, close, and reconnect buttons, and the results table. |
| [fake-database.ts](./fake-database.ts) | A test driver where you finish connections and queries by hand. `ignoresAbort` imitates a driver that ignores cancellation. |
| [orders-report.test.ts](./orders-report.test.ts) | Checks connecting, querying, running twice, failure, cancellation, late answers, closing, and termination. |
| [orders-report-view.test.tsx](./orders-report-view.test.tsx) | Checks querying and cancelling on screen. |

## Note

- After an `await` in an async callback, the Model may already be terminated. Using a [`useMutable`](../../../docs/en/api/useMutable.md) handle of a terminated Model is an error. Here, a query ends with `ResourceActionSupersededError` when the session is aborted, so on that error the callback returns without touching anything. A `useState` setter does nothing when called after termination.

## Usage

```tsx
const report = Behavon.createModel(OrdersReport, { url: "postgres://shop", driver })
root.render(<OrdersReportView report={report} />)
// after unmounting the screen
report.dispose() // closes the connection right away
```
