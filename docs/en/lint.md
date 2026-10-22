# Lint setup

The Hook rules are checked with ESLint, using React's official `rules-of-hooks` together with four Behavon rules.

| Rule | What it checks |
| --- | --- |
| `react-hooks/rules-of-hooks` | Hooks are not called inside conditions, loops, or nested functions |
| `behavon-hooks/canonical-api` | Hooks are called directly, as in `Behavon.useState(...)`, and their results are kept in variables. A default or namespace import is named `Behavon`, and a renamed Hook import starts with `use` |
| `behavon-hooks/evaluation-purity` | A Model body does no outside work (`publish`, Signal calls, and so on) |
| `behavon-hooks/exhaustive-deps` | The dependency arrays of `useMemo`, `useCallback`, and `useEffect` are complete |
| `behavon-hooks/static-model-definition` | The definitions passed to `createModel` and `createPort` are at module top level |

## Setup

Import the plugin from `behavon/eslint`. The rules match the version of Behavon you installed.

```sh
npm install --save-dev eslint@9.39.5 eslint-plugin-react-hooks@7.1.1 \
  @babel/core@7.29.7 @babel/eslint-parser@7.29.9 @babel/preset-typescript@7.29.7
```

```js
// eslint.config.js
import babelParser from "@babel/eslint-parser"
import reactHooks from "eslint-plugin-react-hooks"
import { behavonHooksPlugin } from "behavon/eslint"

const behavonHooks = (files, isTSX) => ({
  files,
  languageOptions: {
    parser: babelParser,
    parserOptions: {
      requireConfigFile: false,
      babelOptions: {
        babelrc: false,
        configFile: false,
        presets: [["@babel/preset-typescript", { allExtensions: true, isTSX }]],
      },
    },
  },
  plugins: {
    "react-hooks": reactHooks,
    "behavon-hooks": behavonHooksPlugin,
  },
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "behavon-hooks/canonical-api": "error",
    "behavon-hooks/evaluation-purity": "error",
    "behavon-hooks/exhaustive-deps": "error",
    "behavon-hooks/static-model-definition": "error",
  },
})

export default [
  behavonHooks(["src/**/*.ts"], false),
  behavonHooks(["src/**/*.tsx"], true),
]
```
