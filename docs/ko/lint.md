# Lint 설정

Hook 규칙은 ESLint로 검사합니다. React 공식 `rules-of-hooks`와 Behavon 규칙 네 가지를 함께 씁니다.

| 규칙 | 검사하는 것 |
| --- | --- |
| `react-hooks/rules-of-hooks` | Hook을 조건문·반복문·중첩 함수 안에서 호출하지 않는다 |
| `behavon-hooks/canonical-api` | `Behavon.useState(...)`처럼 직접 호출하고, Hook 결과는 변수에 담아 쓴다. default·namespace import 이름은 `Behavon`, 이름을 바꿔 가져온 Hook은 `use`로 시작한다 |
| `behavon-hooks/evaluation-purity` | Model 본문에서 외부 작업(`publish`, Signal 호출 등)을 하지 않는다 |
| `behavon-hooks/exhaustive-deps` | `useMemo`·`useCallback`·`useEffect`의 dependency 배열이 빠짐없다 |
| `behavon-hooks/static-model-definition` | `createModel`·`createPort`에 넘기는 정의를 모듈 최상위에 둔다 |

## 설정

플러그인은 `behavon/eslint`에서 import합니다. 설치한 Behavon과 같은 버전의 규칙이 쓰입니다.

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
