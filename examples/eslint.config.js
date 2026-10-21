// The configuration docs/lint.md gives end users. The plugin file is read from the repository root
// instead of a copy so the examples always run against the current rules.
import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";
import { behavonHooksPlugin } from "../eslint.behavon-hooks.js";

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
