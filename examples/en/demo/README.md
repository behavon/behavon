# Demo app

Pick any of the cases above in one React app.

## Running

```sh
# build behavon first, from the repository root
npm run build

cd examples
npm install
npm run demo:en
```

You can open a case directly with its id in the address bar, such as `#counter`.

## What it shows

- Switching cases in one React root. Picking the same case again creates a new Model and screen.
- Unmounting the screen before cleaning up the Model: create the next case's Model, switch the screen with `flushSync`, confirm the previous screen is unmounted, then `dispose()` the previous Model
- Outside services are browser fakes (`browser-services.ts`). They answer after a while and stop right away when the cancellation signal (`AbortSignal`) turns on.

## Cases

| Case | Try this |
| --- | --- |
| Counter | +1, -1, +5, reset |
| Todo list | Add, complete, filter |
| Team board | Select a member, then add a task |
| Search | Type "slow" and then another term right away; the previous search is cancelled |
| Upload queue | A file whose name contains "fail" fails |
| DB session | A query takes 2 seconds, so cancel it in the meantime |
| Quote request | Each supplier answers after a different delay. "screw", "bolt", and "washer" are each not available from one supplier |
| Bank transfer | Sending more than the balance rolls back everything |
| Market simulation | Every press of the next-step button changes the trades and refusals |

[chat](../chat/) needs a real WebSocket server and [api-server](../api-server/) is a Node server, so they are not included.

## Files

| File | Role |
| --- | --- |
| [cases.tsx](./cases.tsx) | The case list. How each case creates and cleans up its Models and screen. |
| [demo-host.tsx](./demo-host.tsx) | `createDemoHost`: the order of switching and cleaning up cases in one React root. |
| [browser-services.ts](./browser-services.ts) | Browser fakes for the search, upload, DB, and quote services. |
| [main.tsx](./main.tsx), [index.html](./index.html) | The case selector and the `#id` in the address. |
| [vite.config.ts](./vite.config.ts) | The configuration of `npm run demo:en`. |
| [demo-host.test.tsx](./demo-host.test.tsx) | Checks cleaning up the Model after the screen is unmounted, restarting the same case, an unknown id, and opening and closing every case without errors. |
| [browser-services.test.ts](./browser-services.test.ts) | Checks the answers and cancellation of the fake services. |
