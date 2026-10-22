// The configuration docs/ko/lint.md and docs/en/lint.md give end users: the plugin comes from the
// installed behavon package, so the examples run against the rules of the version they depend on.
import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";
import { behavonHooksPlugin } from "behavon/eslint";

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
});

export default [
  { ignores: ["node_modules/**"] },
  behavonHooks(["**/*.ts"], false),
  behavonHooks(["**/*.tsx"], true),
];
