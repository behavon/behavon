# behavon

English | [한국어](./README.ko.md)

Behavon is an ESM package that applies the public state semantics of React hooks to Models without sharing a runtime with React, and expresses Model composition and external subscriptions through Signal, Slot, and typed snapshot identities.

## Installation

```sh
npm install behavon
```

## Usage

A Model is a function that calls Hooks and returns a value. A command callable from outside is declared in a Port, implemented with `useSignal`, and opened with `useExport`.

```ts
import Behavon, { type Model, type Signal } from "behavon"

interface CounterPort {
  increment: Signal
}

const counterPort = Behavon.createPort<CounterPort>({ increment: Behavon.SignalType() })

const Counter: Model<undefined, number, CounterPort> = () => {
  const [count, setCount] = Behavon.useState(0)
  const increment = Behavon.useCallback(() => setCount(n => n + 1), [setCount])
  Behavon.useSignal(counterPort, "increment", increment)
  Behavon.useExport(counterPort, "increment")
  return count
}

const counter = Behavon.createModel(Counter, undefined)
counter.increment()
```

To show values in React, see [Getting started](./docs/en/getting-started.md#connecting-to-react).

## Documentation

- [Getting started](./docs/en/getting-started.md)
- [Core concepts](./docs/en/core-concepts.md)
- [Table of contents and API](./docs/en/README.md)
- [Use-case examples](./examples/en/README.md)

## Development commands

```sh
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
```

- `npm test` extracts the documentation examples, then runs the typecheck, the hook lint, the lint rule contract, the runtime tests (including the documentation example tests), and the package type tests.
- `npm run test:docs` extracts only the examples in `docs/ko/`, typechecks, lints, and runs them, and checks that `docs/en/` has the same pages and the same example code.
- `npm run build` generates `dist/index.js` and the TypeScript declarations.
- `npm run pack:check` checks the list of files to be published.

## License

[MIT](./LICENSE)

## Maintenance policy

This project is maintained in my personal spare time.
Issues and PRs are welcome, but there is no guaranteed response time or fix schedule.
Not every feature request will be accepted; decisions are based on the project's direction and maintainability.
