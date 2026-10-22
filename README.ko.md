# behavon

[English](./README.md) | 한국어

Behavon은 React와 runtime을 공유하지 않으면서 React hook의 공개 상태 의미를 Model에 적용하고, Signal·Slot·typed snapshot identity로 Model 조합과 외부 구독을 표현하는 ESM 패키지입니다.

## 설치

```sh
npm install behavon
```

## 사용

Model은 Hook을 부르고 값을 반환하는 함수입니다. 바깥에서 부를 명령은 Port에 선언하고, `useSignal`로 구현한 뒤 `useExport`로 엽니다.

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

React에 값을 보여 주는 방법은 [시작하기](./docs/ko/getting-started.md#react에-연결하기)를 보세요.

## 문서

- [시작하기](./docs/ko/getting-started.md)
- [주요 개념](./docs/ko/core-concepts.md)
- [전체 목차와 API](./docs/ko/README.md)
- [사용 사례별 예제](./examples/ko/README.md)

## 개발 명령

```sh
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
```

- `npm test`는 문서 예제 추출, typecheck, Hook lint, lint 규칙 계약, runtime 테스트(문서 예제 테스트 포함), 패키지 타입 테스트를 실행합니다.
- `npm run test:docs`는 `docs/ko/`의 예제만 추출해 typecheck·lint·실행 테스트를 하고, `docs/en/`이 같은 페이지와 같은 예제 코드를 갖는지 확인합니다.
- `npm run build`는 `dist/index.js`와 TypeScript declaration을 만듭니다.
- `npm run pack:check`는 publish 파일 목록을 확인합니다.

## 라이선스

[MIT](./LICENSE)

## 유지보수 정책

이 프로젝트는 개인 여가 시간에 유지보수하고 있습니다.
이슈와 PR은 환영하지만, 정해진 응답 시간이나 수정 일정을 보장하지 않습니다.
모든 기능 요청이 수용되는 것은 아니며, 프로젝트의 방향과 유지보수 가능성을 기준으로 결정합니다.
