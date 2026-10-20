# behavon

Behavon은 React와 runtime을 공유하지 않으면서 React hook의 공개 상태 의미를 Model에 적용하고, Signal·Slot·typed snapshot identity로 Model 조합과 외부 구독을 표현하는 ESM 패키지다.

## 개발 명령

```sh
npm install
npm run typecheck
npm run build
npm run pack:check
```

- `npm run build`는 `dist/index.js`와 TypeScript declaration을 만든다.
- `npm run pack:check`는 publish 파일 목록을 확인한다.

## 라이선스

[MIT](./LICENSE)

## 유지보수 정책

이 프로젝트는 개인 여가 시간에 유지보수하고 있습니다.
이슈와 PR은 환영하지만, 정해진 응답 시간이나 수정 일정을 보장하지 않습니다.
모든 기능 요청이 수용되는 것은 아니며, 프로젝트의 방향과 유지보수 가능성을 기준으로 결정합니다.
