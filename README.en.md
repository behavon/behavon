# behavon

English | [한국어](./README.md)

Behavon is an ESM package that applies the public state semantics of React hooks to Models without sharing a runtime with React, and expresses Model composition and external subscriptions through Signal, Slot, and typed snapshot identities.

## Documentation

The documentation is currently available in Korean only.

- [Getting started](./docs/getting-started.md)
- [Core concepts](./docs/core-concepts.md)
- [Table of contents and API](./docs/README.md)
- [Use-case examples](./examples/README.md) (Korean)

## Development commands

```sh
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
```

- `npm test` extracts the documentation examples, then runs the typecheck, the hook lint, the lint rule contract, the runtime tests (including the documentation example tests), and the package type tests.
- `npm run test:docs` extracts only the examples in `docs/` and typechecks, lints, and runs them.
- `npm run build` generates `dist/index.js` and the TypeScript declarations.
- `npm run pack:check` checks the list of files to be published.

## License

[MIT](./LICENSE)

## Maintenance policy

This project is maintained in my personal spare time.
Issues and PRs are welcome, but there is no guaranteed response time or fix schedule.
Not every feature request will be accepted; decisions are based on the project's direction and maintainability.
