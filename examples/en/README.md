# Behavon examples

Examples by use case. This directory is a package separate from behavon and uses only the public API of the published `behavon` package.

## Running

```sh
# build behavon first, from the repository root
npm run build

cd examples
npm install
npm test
```

`npm test` runs the typecheck, the [lint](../../docs/en/lint.md), and the example tests. `npm run demo:en` opens a [demo app](./demo/) where you pick a case in the browser.

## List

| Example | What it shows |
| --- | --- |
| [counter](./counter/) | State, Port declarations and `useExport`, connecting to React |
| [todo-list](./todo-list/) | State transitions with a reducer, derived values, per-area snapshots, a separate Presenter |
| [team-board](./team-board/) | Assembling several Models, Signal→Slot connections, a derived Model, Effect cleanup, async saving |
| [search](./search/) | `latest` of `useFuture`, cancellation, showing progress |
| [upload-queue](./upload-queue/) | `serial` of `useFuture`, processing in order |
| [chat](./chat/) | Opening and closing a WebSocket with `useResource`, handling drops |
| [db-session](./db-session/) | `useResource` actions, cancelling a query in progress |
| [quote-request](./quote-request/) | Asking several suppliers and collecting their answers |
| [bank-transfer](./bank-transfer/) | A transaction across several Models, rolling back on failure |
| [api-server](./api-server/) | Receiving HTTP requests as Signals and handling them with services and stores, shutdown order |
| [market-simulation](./market-simulation/) | A large Model graph, deterministic reproduction, transactions |
| [demo](./demo/) | Picking the cases above in one React app |

## Common rules

- Models and Ports are defined at module top level.
- Signals and snapshots exposed to the outside are declared with `createPort` and opened with `useExport`.
- React components hold only screen logic. State computation lives in Models.
- Unmount the React screen first, then `dispose()` the Model.
- Each example checks its behavior with the tests in the same directory.
