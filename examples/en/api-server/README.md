# Member API server

An HTTP server that handles sign-up, sign-in, and reading your own profile. It uses only Node's built-in `node:http`.

## What it shows

- Turning an HTTP request into a request object (`input`, `reply`, `reject`), sending it through an exposed Signal (`Gateway`), and letting the connected service Slot (`UserService`) answer
- A Signal returns no value, so the answer comes through the request object's `reply` or `reject`. Only the first answer is used; later ones are dropped.
- Connecting each Signal to exactly one service Slot (`Routes`), so one side answers each request
- Error isolation: an error thrown by a Slot comes back to the HTTP adapter that called the Signal, so only that request ends with 500 and the server keeps running. If nobody answers, 503.
- Shutdown order: stop the HTTP server from taking new requests, wait for the requests in progress, then release `Routes` → `Gateway` → `UserService` → the store

## API

| Method | Path | Auth | Input | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | none | none | `200` |
| `POST` | `/users` | none | `email`, `password` (8 or more characters), `name` | `201`, the user |
| `POST` | `/sessions` | none | `email`, `password` | `200`, a `token` and the user |
| `GET` | `/me` | `Authorization: Bearer <token>` | none | `200`, the user |

Failures are `{ error: { code, message } }`: invalid input `400`, authentication failure `401`, an already registered email `409`, a processing error `500`, a response timeout `503`. A wrong password and an unknown email get the same response.

## Files

| File | Role |
| --- | --- |
| [contracts.ts](./contracts.ts) | The request object (`ApiRequest`), failure (`ApiFailure`), user types, and `GatewayPort`. |
| [application.ts](./application.ts) | The `Gateway` and `Routes` Models and the assembly function `createApplication`. |
| [user-service.ts](./user-service.ts) | The `UserService` Model. The sign-up, sign-in, and profile Slots. |
| [user-store.ts](./user-store.ts) | An in-memory store. A real server would put a DB here. |
| [security.ts](./security.ts) | `scrypt` password hashing and token generation. |
| [http.ts](./http.ts) | The handler that turns HTTP requests into Signal calls. |
| [server.ts](./server.ts) | `startServer`: starting the server and shutting down in order. |
| [application.test.ts](./application.test.ts) | Checks sign-up, sign-in, and profile reads through Signals without HTTP, duplicates, invalid input, and authentication. Also checks one answer per request. |
| [server.test.ts](./server.test.ts) | Checks the flow and status codes over real HTTP, 500 for a Slot error, 503 for a timeout, first answer wins, and shutting down after the requests in progress finish. |

## Note

- Error isolation happens on the side that calls the Signal (the HTTP adapter).
- If the response times out before async work (`scrypt`) finishes, the work keeps going and its late answer is dropped. A save that already started is not undone.
- This is an example. Session expiry, sign-out, rate limiting, TLS, and so on are not covered.

## Usage

```ts
const server = await startServer({ port: 3000 })
// send requests to server.url
await server.stop() // releases the Models and the store after the requests in progress finish
```
