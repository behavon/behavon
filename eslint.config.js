import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";
import { behavonHooksPlugin } from "./eslint.behavon-hooks.js";

const hookAuthoringRules = {
  "react-hooks/rules-of-hooks": "error",
  "behavon-hooks/canonical-api": "error",
  "behavon-hooks/evaluation-purity": "error",
  "behavon-hooks/exhaustive-deps": "error",
};

const staticModelDefinitionRules = {
  ...hookAuthoringRules,
  "behavon-hooks/static-model-definition": "error",
};

function typescriptConfig(files, isTSX, rules = hookAuthoringRules) {
  return {
    files,
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          presets: [
            ["@babel/preset-typescript", { allExtensions: true, isTSX }],
          ],
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "behavon-hooks": behavonHooksPlugin,
    },
    rules,
  };
}

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "tests/lint-fixtures/invalid/**",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  typescriptConfig(
    ["src/**/*.ts"],
    false,
    staticModelDefinitionRules,
  ),
  typescriptConfig(
    ["tests/**/*.ts"],
    false,
  ),
  typescriptConfig(
    ["tests/**/*.tsx"],
    true,
  ),
  {
    // Documentation examples follow the configuration that docs/lint.md gives end users.
    files: ["tests/docs/.generated/**/*.ts", "tests/docs/.generated/**/*.tsx"],
    rules: staticModelDefinitionRules,
  },
  {
    files: [
      "tests/lint-fixtures/valid/static-model-definition.ts",
      "tests/lint-fixtures/invalid/static-model-definition.ts",
      "tests/lint-fixtures/invalid/port-*.ts",
      "tests/lint-fixtures/invalid/dynamic-resource-definition.ts",
      "tests/lint-fixtures/invalid/indirect-resource-definition.ts",
    ],
    rules: {
      "behavon-hooks/static-model-definition": "error",
    },
  },
];
