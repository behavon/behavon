import type { ESLint } from "eslint";

/** The Hook names the Behavon lint rules treat as public Behavon Hooks. */
export declare const behavonPublicHookNames: readonly string[];

/** The `behavon-hooks` ESLint plugin: canonical-api, evaluation-purity, exhaustive-deps, static-model-definition. */
export declare const behavonHooksPlugin: ESLint.Plugin;
