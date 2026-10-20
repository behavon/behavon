import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eslint = new ESLint({ cwd: root, ignore: false });
const canonicalRule = "behavon-hooks/canonical-api";
const evaluationPurityRule = "behavon-hooks/evaluation-purity";
const exhaustiveDependenciesRule = "behavon-hooks/exhaustive-deps";
const staticModelDefinitionRule = "behavon-hooks/static-model-definition";
const reactHooksRule = "react-hooks/rules-of-hooks";
const reactExhaustiveDependenciesRule = "react-hooks/exhaustive-deps";

function diagnostic(file, ruleId, messageId, line, column) {
  return {
    file: `tests/lint-fixtures/invalid/${file}`,
    ruleId,
    messageId,
    line,
    column,
  };
}

const expectedInvalidDiagnostics = [
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 4, 8),
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 9, 3),
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 10, 3),
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 11, 3),
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 12, 3),
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 14, 3),
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 16, 3),
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 17, 3),
  diagnostic("evaluation-future-command.ts", evaluationPurityRule, "evaluationOperation", 19, 3),
  diagnostic("conditional-resource-hook.ts", reactHooksRule, null, 7, 24),
  diagnostic("dynamic-resource-definition.ts", staticModelDefinitionRule, "dynamicResourceDefinition", 4, 10),
  diagnostic("evaluation-resource-command.ts", evaluationPurityRule, "evaluationOperation", 12, 3),
  diagnostic("evaluation-resource-command.ts", evaluationPurityRule, "evaluationOperation", 13, 3),
  diagnostic("indirect-resource-definition.ts", staticModelDefinitionRule, "indirectResourceDefinition", 3, 19),
  diagnostic("indirect-resource-definition.ts", staticModelDefinitionRule, "indirectResourceDefinition", 4, 9),
  diagnostic("indirect-resource-definition.ts", staticModelDefinitionRule, "dynamicResourceDefinition", 9, 10),
  diagnostic("raw-websocket-evaluation.ts", evaluationPurityRule, "impureCall", 7, 10),
  diagnostic("arbitrary-helper.ts", reactHooksRule, null, 4, 10),
  diagnostic("bad-named-hook-alias.ts", canonicalRule, "namedHookAlias", 1, 22),
  diagnostic("callback.ts", reactHooksRule, null, 4, 24),
  diagnostic("computed-hook.ts", canonicalRule, "computedNamespaceMember", 4, 10),
  diagnostic("computed-namespace-member.ts", canonicalRule, "computedNamespaceMember", 5, 17),
  diagnostic("computed-namespace-member.ts", canonicalRule, "computedNamespaceMember", 11, 17),
  diagnostic("computed-namespace-member.ts", canonicalRule, "computedNamespaceMember", 15, 17),
  diagnostic("computed-namespace-member.ts", canonicalRule, "computedNamespaceMember", 20, 17),
  diagnostic("computed-namespace-member.ts", canonicalRule, "computedNamespaceMember", 24, 17),
  diagnostic("computed-namespace-member.ts", canonicalRule, "computedNamespaceMember", 28, 17),
  diagnostic("computed-static-hook.ts", canonicalRule, "computedNamespaceMember", 9, 3),
  diagnostic("computed-static-hook.ts", canonicalRule, "computedNamespaceMember", 11, 3),
  diagnostic("computed-static-hook.ts", canonicalRule, "computedNamespaceMember", 12, 3),
  diagnostic("computed-static-hook.ts", canonicalRule, "computedNamespaceMember", 13, 3),
  diagnostic("conditional-use-port.ts", canonicalRule, "discardedValueHook", 6, 29),
  diagnostic("conditional-use-port.ts", reactHooksRule, null, 6, 29),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 4, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 4, 16),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 5, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 5, 16),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 6, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 6, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 7, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 8, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 9, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 10, 16),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 11, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 11, 16),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 13, 24),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 13, 24),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 16, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 17, 16),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 18, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 18, 16),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 19, 16),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 21, 21),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 21, 21),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 25, 21),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 25, 21),
  diagnostic("conditional-public-hook-matrix.ts", canonicalRule, "discardedValueHook", 29, 22),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 29, 22),
  diagnostic("conditional-public-hook-matrix.ts", reactHooksRule, null, 33, 20),
  diagnostic("conditional.ts", canonicalRule, "discardedValueHook", 4, 16),
  diagnostic("conditional.ts", reactHooksRule, null, 4, 16),
  diagnostic("custom-hook-try.ts", canonicalRule, "tryHook", 10, 12),
  diagnostic("default-conditional.ts", reactHooksRule, null, 5, 21),
  diagnostic("default-facade.ts", canonicalRule, "computedNamespaceMember", 4, 18),
  diagnostic("default-facade.ts", canonicalRule, "extractedHook", 5, 9),
  diagnostic("default-facade.ts", canonicalRule, "extractedHook", 6, 19),
  diagnostic("default-facade.ts", canonicalRule, "namespaceAlias", 7, 7),
  diagnostic("default-facade.ts", canonicalRule, "namespaceAlias", 8, 9),
  diagnostic("default-facade.ts", canonicalRule, "computedNamespaceMember", 9, 9),
  diagnostic("default-facade.ts", canonicalRule, "computedNamespaceMember", 11, 9),
  diagnostic("default-name.ts", canonicalRule, "defaultName", 1, 8),
  diagnostic("default-name.ts", canonicalRule, "namespaceAlias", 3, 6),
  diagnostic("default-specifier-name.ts", canonicalRule, "defaultName", 1, 21),
  diagnostic("default-specifier-name.ts", canonicalRule, "namespaceAlias", 3, 7),
  diagnostic("destructured-hook.ts", canonicalRule, "extractedHook", 4, 11),
  diagnostic("direct-hook-return.ts", canonicalRule, "directHookReturn", 6, 10),
  diagnostic("direct-hook-return.ts", canonicalRule, "directHookReturn", 9, 48),
  diagnostic("direct-hook-return.ts", canonicalRule, "directHookReturn", 12, 10),
  diagnostic("discarded-use-port.ts", evaluationPurityRule, "nonLocalMutation", 23, 3),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 10, 3),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 11, 3),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 12, 3),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 13, 3),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 14, 3),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 15, 28),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 16, 26),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 18, 32),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 20, 30),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 22, 14),
  diagnostic("discarded-use-port.ts", canonicalRule, "discardedValueHook", 23, 24),
  diagnostic("discarded-satisfies.ts", canonicalRule, "discardedValueHook", 8, 3),
  diagnostic("discarded-satisfies.ts", canonicalRule, "discardedValueHook", 9, 3),
  diagnostic("discarded-satisfies.ts", canonicalRule, "discardedValueHook", 10, 3),
  diagnostic("discarded-satisfies.ts", canonicalRule, "discardedValueHook", 11, 3),
  diagnostic("discarded-satisfies.ts", canonicalRule, "discardedValueHook", 12, 3),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencies", 11, 59),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "duplicateDependencies", 16, 46),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "dynamicDependencies", 21, 46),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencies", 21, 46),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "dynamicDependencies", 29, 39),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencies", 29, 39),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencyArray", 35, 17),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencyArray", 37, 20),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencies", 42, 52),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "complexDependency", 42, 53),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "outerScopeDependencies", 47, 52),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "unnecessaryDependencies", 52, 42),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "unnecessaryDependencies", 53, 57),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "unknownDependencies", 59, 17),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "unknownDependencies", 64, 17),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "staleAssignment", 71, 13),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencies", 82, 6),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencies", 92, 37),
  diagnostic("dependency-completeness.ts", exhaustiveDependenciesRule, "missingDependencies", 99, 40),
  diagnostic("early-return.ts", canonicalRule, "discardedValueHook", 5, 3),
  diagnostic("early-return.ts", reactHooksRule, null, 5, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 15, 3),
  diagnostic("export-result-mutation.ts", evaluationPurityRule, "immutableValue", 6, 3),
  diagnostic("export-initializer-purity.ts", evaluationPurityRule, "nonLocalMutation", 7, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 16, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 17, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 18, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 20, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 21, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 22, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 23, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 24, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 25, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 26, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 27, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 35, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 36, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 37, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 38, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 39, 5),
  diagnostic("evaluation-purity.ts", exhaustiveDependenciesRule, "missingDependencies", 40, 6),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 43, 18),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 43, 31),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 43, 47),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 44, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 45, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 55, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 56, 4),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 57, 4),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 58, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 59, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 60, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 61, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 75, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 76, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 77, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 78, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 79, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 80, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 81, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 84, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 89, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 98, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 106, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 112, 7),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 120, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 128, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 138, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 148, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 149, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 150, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 151, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 158, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 159, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 163, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 171, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 181, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 185, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 189, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 210, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 211, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 213, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 219, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 226, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 235, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 266, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 267, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 268, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 277, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 278, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 279, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 280, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 293, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 294, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 295, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "immutableValue", 296, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 297, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 313, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 314, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 315, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 316, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 321, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 325, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 334, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 350, 18),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 350, 26),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 350, 46),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "impureCall", 350, 92),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 354, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "nonLocalMutation", 358, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 375, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 378, 5),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 388, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 395, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 404, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 405, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 406, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 407, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 408, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 409, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 422, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 423, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 424, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 425, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 430, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 431, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 432, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "evaluationOperation", 433, 3),
  diagnostic("evaluation-purity.ts", evaluationPurityRule, "asyncTransactionRun", 442, 33),
  diagnostic("extracted-hook.ts", canonicalRule, "extractedHook", 4, 21),
  diagnostic("inline-hook-result.ts", canonicalRule, "inlineHookResult", 9, 17),
  diagnostic("inline-hook-result.ts", canonicalRule, "inlineHookResult", 10, 20),
  diagnostic("inline-hook-result.ts", canonicalRule, "inlineHookResult", 11, 18),
  diagnostic("inline-hook-result.ts", canonicalRule, "inlineHookResult", 12, 11),
  diagnostic("inline-hook-result.ts", evaluationPurityRule, "nonLocalMutation", 11, 3),
  diagnostic("loop.ts", canonicalRule, "discardedValueHook", 4, 31),
  diagnostic("loop.ts", reactHooksRule, null, 4, 31),
  diagnostic("lowercase-model.ts", reactHooksRule, null, 4, 10),
  diagnostic("bad-use-port-alias.ts", canonicalRule, "namedHookAlias", 1, 21),
  diagnostic("namespace-alias.ts", canonicalRule, "namespaceName", 1, 13),
  diagnostic("namespace-copy.ts", canonicalRule, "namespaceAlias", 3, 7),
  diagnostic("namespace-copy.ts", canonicalRule, "namespaceAlias", 4, 7),
  diagnostic("namespace-copy.ts", canonicalRule, "namespaceAlias", 6, 1),
  diagnostic("namespace-copy.ts", canonicalRule, "namespaceAlias", 7, 7),
  diagnostic("namespace-copy.ts", canonicalRule, "namespaceAlias", 8, 7),
  diagnostic("namespace-copy.ts", canonicalRule, "namespaceAlias", 10, 9),
  diagnostic("namespace-copy.ts", canonicalRule, "namespaceAlias", 12, 10),
  diagnostic("namespace-copy.ts", canonicalRule, "namespaceAlias", 14, 18),
  diagnostic("namespace-default.ts", canonicalRule, "namespaceAlias", 4, 19),
  diagnostic("namespace-default.ts", canonicalRule, "computedNamespaceMember", 9, 19),
  diagnostic("namespace-default.ts", canonicalRule, "namespaceAlias", 13, 23),
  diagnostic("namespace-default.ts", canonicalRule, "namespaceAlias", 14, 9),
  diagnostic("namespace-lowercase.ts", canonicalRule, "namespaceName", 1, 13),
  diagnostic("nested-connect-use-port.ts", canonicalRule, "nestedEndpointHook", 8, 30),
  diagnostic("nested-signal-hook.ts", canonicalRule, "nestedEndpointHook", 4, 30),
  diagnostic("nested-slot-hook.ts", canonicalRule, "nestedEndpointHook", 4, 28),
  diagnostic("optional-hook.ts", canonicalRule, "optionalHook", 4, 19),
  diagnostic("optional-hook.ts", canonicalRule, "optionalHook", 9, 19),
  diagnostic("port-boundary-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 19, 7),
  diagnostic("port-boundary-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 22, 7),
  diagnostic("port-boundary-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 28, 3),
  diagnostic("port-boundary-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 35, 3),
  diagnostic("port-boundary-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 42, 3),
  diagnostic("port-boundary-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 47, 3),
  diagnostic("port-boundary-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 51, 66),
  diagnostic("port-boundary-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 53, 16),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 40, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 45, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 50, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 55, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 60, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 66, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 72, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 79, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mixedPortDescriptors", 84, 7),
  diagnostic("port-carrier-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 91, 7),
  diagnostic("port-contextual-composition.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 25, 3),
  diagnostic("port-contextual-composition.ts", staticModelDefinitionRule, "missingPortDescriptor", 30, 3),
  diagnostic("port-contextual-composition.ts", staticModelDefinitionRule, "mixedPortDescriptors", 31, 3),
  diagnostic("port-contextual-composition.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 41, 3),
  diagnostic("port-contextual-composition.ts", staticModelDefinitionRule, "missingPortDescriptor", 46, 3),
  diagnostic("port-contextual-composition.ts", staticModelDefinitionRule, "mixedPortDescriptors", 47, 3),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 15, 28),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 16, 28),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 17, 28),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 19, 28),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 20, 28),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 24, 37),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 28, 34),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 36, 8),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "reservedPortMemberName", 40, 38),
  diagnostic("port-declaration-shape.ts", staticModelDefinitionRule, "reservedPortMemberName", 47, 5),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 18, 7),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingModelPort", 24, 10),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingModelPort", 30, 10),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingModelPort", 36, 10),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingModelPort", 42, 17),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "nonPreservingModelType", 49, 10),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 59, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "nonPreservingModelType", 66, 46),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 83, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 88, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mixedPortDescriptors", 89, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 103, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 108, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mixedPortDescriptors", 109, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 119, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 124, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mixedPortDescriptors", 125, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "nonPreservingModelType", 134, 41),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 149, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 154, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mixedPortDescriptors", 155, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 167, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "missingPortDescriptor", 172, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mixedPortDescriptors", 173, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "nonPreservingModelType", 182, 49),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "nonPreservingModelType", 190, 49),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 209, 21),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 210, 54),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 211, 21),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 213, 3),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "nonPreservingModelType", 217, 27),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "nonPreservingModelType", 223, 34),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 229, 68),
  diagnostic("port-model-linkage.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 239, 16),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 1, 10),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 7, 33),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 8, 53),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 9, 32),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 11, 26),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 12, 48),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 13, 26),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 14, 32),
  diagnostic("port-provenance.ts", staticModelDefinitionRule, "indirectPortDefinition", 15, 33),
  diagnostic("reexported-hook.ts", canonicalRule, "hookReexport", 1, 10),
  diagnostic("reexported-hook.ts", canonicalRule, "hookReexport", 2, 1),
  diagnostic("reexported-hook.ts", canonicalRule, "hookReexport", 3, 10),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "nonInlinePortDeclaration", 18, 52),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "indirectPortDefinition", 19, 18),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "indirectPortDefinition", 20, 9),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "indirectPortDefinition", 21, 35),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "indirectPortDefinition", 22, 26),
  diagnostic("static-model-definition.ts", canonicalRule, "namespaceAlias", 22, 50),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "indirectPortDefinition", 24, 36),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "indirectPortDefinition", 32, 45),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "missingPortDescriptor", 34, 7),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "missingModelPort", 36, 7),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 42, 7),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "mixedPortDescriptors", 48, 7),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 58, 7),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 64, 7),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "nonPreservingModelType", 64, 34),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "mismatchedPortDescriptor", 70, 7),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "dynamicModelDefinition", 96, 23),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "inlineModelDefinition", 97, 23),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "inlineModelDefinition", 98, 23),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "dynamicBoundaryDefinition", 99, 3),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "dynamicModelFactory", 100, 23),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "dynamicModelFactory", 102, 23),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "dynamicModelDefinition", 104, 23),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "dynamicPortDefinition", 105, 3),
  diagnostic("static-model-definition.ts", staticModelDefinitionRule, "dynamicPortDefinition", 106, 3),
  diagnostic("try-catch.ts", canonicalRule, "tryHook", 5, 5),
  diagnostic("try-catch.ts", canonicalRule, "discardedValueHook", 5, 5),
  diagnostic("unused-disable-directive.ts", null, null, 1, 1),
  diagnostic("use-reducer.ts", evaluationPurityRule, "nonLocalMutation", 9, 5),
  diagnostic("use-reducer.ts", evaluationPurityRule, "evaluationOperation", 10, 5),
  diagnostic("use-reducer.ts", canonicalRule, "discardedValueHook", 11, 5),
  diagnostic("use-reducer.ts", reactHooksRule, null, 11, 5),
  diagnostic("use-reducer.ts", evaluationPurityRule, "nonLocalMutation", 15, 5),
  diagnostic("use-reducer.ts", evaluationPurityRule, "evaluationOperation", 16, 5),
  diagnostic("use-reducer.ts", canonicalRule, "discardedValueHook", 17, 5),
  diagnostic("use-reducer.ts", reactHooksRule, null, 17, 5),
  diagnostic("use-reducer.ts", exhaustiveDependenciesRule, "missingDependencies", 17, 36),
  diagnostic("wrapped-namespace-hook.ts", canonicalRule, "wrappedNamespaceHook", 4, 19),
  diagnostic("wrapped-namespace-hook.ts", canonicalRule, "wrappedNamespaceHook", 5, 16),
  diagnostic("wrapped-namespace-hook.ts", canonicalRule, "computedNamespaceMember", 6, 20),
];

function failures(results) {
  return results.flatMap((result) => result.messages
    .filter((message) => message.severity === 2)
    .map((message) => ({
      file: path.relative(root, result.filePath).split(path.sep).join("/"),
      ruleId: message.ruleId,
      messageId: message.messageId ?? null,
      line: message.line,
      column: message.column,
    })));
}

function suggestionContract(results, ruleId) {
  return results.flatMap((result) => result.messages
    .filter((message) => message.ruleId === ruleId)
    .map((message) => ({
      line: message.line,
      column: message.column,
      suggestions: (message.suggestions ?? []).map((suggestion) => suggestion.fix.text),
    })));
}

function assertSuggestionContract(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  throw new Error(
    `${label} suggestion contract failed:\nExpected:\n${JSON.stringify(expected, null, 2)}\n` +
    `Actual:\n${JSON.stringify(actual, null, 2)}`,
  );
}

function diagnosticKey(value) {
  return JSON.stringify([
    value.file,
    value.ruleId,
    value.messageId,
    value.line,
    value.column,
  ]);
}

function diagnosticMultiset(values) {
  const result = new Map();
  for (const value of values) {
    const key = diagnosticKey(value);
    const entry = result.get(key);
    if (entry === undefined) {
      result.set(key, { diagnostic: value, count: 1 });
    } else {
      entry.count += 1;
    }
  }
  return result;
}

function diagnosticDifference(expected, actual) {
  const expectedSet = diagnosticMultiset(expected);
  const actualSet = diagnosticMultiset(actual);
  const missing = [];
  const unexpected = [];

  for (const [key, entry] of expectedSet) {
    const difference = entry.count - (actualSet.get(key)?.count ?? 0);
    if (difference > 0) missing.push({ ...entry.diagnostic, count: difference });
  }
  for (const [key, entry] of actualSet) {
    const difference = entry.count - (expectedSet.get(key)?.count ?? 0);
    if (difference > 0) unexpected.push({ ...entry.diagnostic, count: difference });
  }

  return { missing, unexpected };
}

function assertExactDiagnostics(label, expected, actual) {
  const difference = diagnosticDifference(expected, actual);
  if (difference.missing.length === 0 && difference.unexpected.length === 0) return;
  throw new Error(
    `${label} diagnostic contract failed:\n` +
    `Missing:\n${JSON.stringify(difference.missing, null, 2)}\n` +
    `Unexpected:\n${JSON.stringify(difference.unexpected, null, 2)}`,
  );
}

function assertMutationRejected(label, mutated) {
  const difference = diagnosticDifference(expectedInvalidDiagnostics, mutated);
  if (difference.missing.length === 0 || difference.unexpected.length === 0) {
    throw new Error(
      `${label} mutation did not produce both missing and unexpected diagnostics:\n` +
      JSON.stringify(difference, null, 2),
    );
  }
}

function verifyOracleMutations() {
  const removed = expectedInvalidDiagnostics.slice(1);
  const removedDifference = diagnosticDifference(expectedInvalidDiagnostics, removed);
  if (removedDifference.missing.length === 0 || removedDifference.unexpected.length !== 0) {
    throw new Error(`Removal mutation was not rejected as missing:\n${JSON.stringify(removedDifference, null, 2)}`);
  }

  const duplicated = [...expectedInvalidDiagnostics];
  const duplicateSource = duplicated.findIndex((value) =>
    value.file.endsWith("conditional-public-hook-matrix.ts") &&
    value.ruleId === reactHooksRule &&
    value.line === 5
  );
  const replaced = duplicated.findIndex((value) =>
    value.file.endsWith("conditional-public-hook-matrix.ts") &&
    value.ruleId === reactHooksRule &&
    value.line === 4
  );
  duplicated[replaced] = { ...duplicated[duplicateSource] };
  assertMutationRejected("Same-file diagnostic duplication", duplicated);

  const relocated = expectedInvalidDiagnostics.map((value, index) =>
    index === 0 ? { ...value, column: value.column + 1 } : value
  );
  assertMutationRejected("Location", relocated);

  const changedMessageId = expectedInvalidDiagnostics.map((value, index) =>
    index === 1 ? { ...value, messageId: `${value.messageId}-mutated` } : value
  );
  assertMutationRejected("MessageId", changedMessageId);

  const purityRelocation = expectedInvalidDiagnostics.map((value) =>
    value.ruleId === evaluationPurityRule &&
    value.file.endsWith("evaluation-purity.ts") &&
    value.line === 36
      ? { ...value, column: value.column + 1 }
      : value
  );
  assertMutationRejected("Evaluation purity location", purityRelocation);

  const exhaustiveRelocation = expectedInvalidDiagnostics.map((value) =>
    value.ruleId === exhaustiveDependenciesRule &&
    value.file.endsWith("dependency-completeness.ts") &&
    value.messageId === "missingDependencies" &&
    value.line === 11
      ? { ...value, column: value.column + 1 }
      : value
  );
  assertMutationRejected("Dependency completeness location", exhaustiveRelocation);

  for (const messageId of [
    "nonInlinePortDeclaration",
    "missingPortDescriptor",
    "missingModelPort",
    "mismatchedPortDescriptor",
    "mixedPortDescriptors",
    "indirectPortDefinition",
    "dynamicPortDefinition",
    "nonPreservingModelType",
  ]) {
    const portContractRelocation = expectedInvalidDiagnostics.map((value) =>
      value.ruleId === staticModelDefinitionRule && value.messageId === messageId
        ? { ...value, column: value.column + 1 }
        : value
    );
    assertMutationRejected(`Static Port contract ${messageId}`, portContractRelocation);
  }

  const portExtractionRelocation = expectedInvalidDiagnostics.map((value) =>
    value.file.endsWith("static-model-definition.ts") &&
    value.ruleId === staticModelDefinitionRule &&
    value.messageId === "indirectPortDefinition" &&
    value.line === 19
      ? { ...value, column: value.column + 1 }
      : value
  );
  assertMutationRejected("Static Port extraction location", portExtractionRelocation);

  for (const [label, file, messageId, line] of [
    ["Static Port declaration shape", "port-declaration-shape.ts", "nonInlinePortDeclaration", 15],
    ["Static Port provenance", "port-provenance.ts", "indirectPortDefinition", 1],
    ["Static Port carrier linkage", "port-carrier-linkage.ts", "mismatchedPortDescriptor", 40],
    ["Static Boundary direct Port", "port-boundary-linkage.ts", "missingPortDescriptor", 19],
    ["Static Boundary alias Port", "port-boundary-linkage.ts", "missingPortDescriptor", 22],
    ["Static Boundary object Port", "port-boundary-linkage.ts", "missingPortDescriptor", 28],
    ["Static Boundary called object Port", "port-boundary-linkage.ts", "missingPortDescriptor", 35],
    ["Static Boundary tuple Port", "port-boundary-linkage.ts", "missingPortDescriptor", 42],
    ["Static Boundary asserted call Port", "port-boundary-linkage.ts", "missingPortDescriptor", 47],
    ["Static Boundary explicit generic Port", "port-boundary-linkage.ts", "missingPortDescriptor", 51],
    ["Static Boundary default Port", "port-boundary-linkage.ts", "missingPortDescriptor", 53],
    ["Static extended contextual mismatch", "port-contextual-composition.ts", "mismatchedPortDescriptor", 25],
    ["Static extended contextual missing", "port-contextual-composition.ts", "missingPortDescriptor", 30],
    ["Static extended contextual mixed", "port-contextual-composition.ts", "mixedPortDescriptors", 31],
    ["Static intersected contextual mismatch", "port-contextual-composition.ts", "mismatchedPortDescriptor", 41],
    ["Static intersected contextual missing", "port-contextual-composition.ts", "missingPortDescriptor", 46],
    ["Static intersected contextual mixed", "port-contextual-composition.ts", "mixedPortDescriptors", 47],
    ["Static Port marker alias", "port-declaration-shape.ts", "nonInlinePortDeclaration", 28],
    ["Static Port empty member name", "port-declaration-shape.ts", "reservedPortMemberName", 40],
    ["Static Port recursive proto member", "port-declaration-shape.ts", "reservedPortMemberName", 47],
    ["Static Port static module source", "port-provenance.ts", "indirectPortDefinition", 14],
    ["Static contextual object Model", "port-model-linkage.ts", "mismatchedPortDescriptor", 59],
    ["Static object satisfies inference", "port-model-linkage.ts", "nonPreservingModelType", 66],
    ["Static interface object mismatch", "port-model-linkage.ts", "mismatchedPortDescriptor", 83],
    ["Static interface object missing", "port-model-linkage.ts", "missingPortDescriptor", 88],
    ["Static interface object mixed", "port-model-linkage.ts", "mixedPortDescriptors", 89],
    ["Static contextual tuple mismatch", "port-model-linkage.ts", "mismatchedPortDescriptor", 103],
    ["Static contextual tuple missing", "port-model-linkage.ts", "missingPortDescriptor", 108],
    ["Static contextual tuple mixed", "port-model-linkage.ts", "mixedPortDescriptors", 109],
    ["Static contextual array mismatch", "port-model-linkage.ts", "mismatchedPortDescriptor", 119],
    ["Static contextual array missing", "port-model-linkage.ts", "missingPortDescriptor", 124],
    ["Static contextual array mixed", "port-model-linkage.ts", "mixedPortDescriptors", 125],
    ["Static tuple satisfies inference", "port-model-linkage.ts", "nonPreservingModelType", 134],
    ["Static readonly tuple mismatch", "port-model-linkage.ts", "mismatchedPortDescriptor", 149],
    ["Static readonly tuple missing", "port-model-linkage.ts", "missingPortDescriptor", 154],
    ["Static readonly tuple mixed", "port-model-linkage.ts", "mixedPortDescriptors", 155],
    ["Static readonly array mismatch", "port-model-linkage.ts", "mismatchedPortDescriptor", 167],
    ["Static readonly array missing", "port-model-linkage.ts", "missingPortDescriptor", 172],
    ["Static readonly array mixed", "port-model-linkage.ts", "mixedPortDescriptors", 173],
    ["Static readonly tuple satisfies inference", "port-model-linkage.ts", "nonPreservingModelType", 182],
    ["Static readonly array satisfies inference", "port-model-linkage.ts", "nonPreservingModelType", 190],
    ["Static Model call-site linkage", "port-model-linkage.ts", "mismatchedPortDescriptor", 209],
    ["Static readonly indexed call-site linkage", "port-model-linkage.ts", "mismatchedPortDescriptor", 213],
    ["Static Model non-preserving annotation", "port-model-linkage.ts", "nonPreservingModelType", 49],
    ["Static Model aliased satisfies", "port-model-linkage.ts", "nonPreservingModelType", 223],
    ["Static Model inner contract", "port-model-linkage.ts", "mismatchedPortDescriptor", 229],
  ]) {
    const relocation = expectedInvalidDiagnostics.map((value) =>
      value.file.endsWith(file) && value.messageId === messageId && value.line === line
        ? { ...value, column: value.column + 1 }
        : value
    );
    assertMutationRejected(label, relocation);
  }

  for (const [label, line] of [
    ["Write-only helper dependency", 92],
    ["Reassigned stable capability", 99],
  ]) {
    const dependencyRelocation = expectedInvalidDiagnostics.map((value) =>
      value.ruleId === exhaustiveDependenciesRule &&
      value.file.endsWith("dependency-completeness.ts") &&
      value.line === line
        ? { ...value, column: value.column + 1 }
        : value
    );
    assertMutationRejected(label, dependencyRelocation);
  }

  for (const [label, line] of [
    ["Hook-free custom Hook", 138],
    ["Operation call/apply", 148],
    ["Deferred immutability", 158],
    ["Helper immutable argument", 171],
    ["Helper external argument", 181],
    ["Member Hook assignment", 210],
    ["Default-export custom Hook", 219],
    ["Latest assigned callable", 226],
    ["Named collection shape", 266],
    ["Lazy Hook collection shape", 277],
    ["Nested container provenance", 293],
    ["Stored operation provenance", 313],
    ["Callable parameter provenance", 321],
    ["Impure callable alias", 350],
    ["Direct stored helper", 354],
    ["Direct stored managed callback", 375],
    ["Dependency endpoint helper parameter", 388],
    ["Dependency proxy helper parameter", 395],
    ["Dependency endpoint direct invocation", 404],
  ]) {
    const categoryRelocation = expectedInvalidDiagnostics.map((value) =>
      value.ruleId === evaluationPurityRule &&
      value.file.endsWith("evaluation-purity.ts") &&
      value.line === line
        ? { ...value, column: value.column + 1 }
        : value
    );
    assertMutationRejected(label, categoryRelocation);
  }
}

verifyOracleMutations();

const reactOracleEslint = new ESLint({
  cwd: root,
  overrideConfig: {
    rules: {
      [reactExhaustiveDependenciesRule]: "error",
    },
  },
});
const reactOracleResults = await reactOracleEslint.lintFiles([
  "tests/lint-fixtures/react/dependency-completeness.tsx",
]);
assertExactDiagnostics("React exhaustive-deps actual oracle", [{
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 10,
  column: 6,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 18,
  column: 44,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 18,
  column: 44,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 25,
  column: 13,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 33,
  column: 3,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 38,
  column: 35,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 46,
  column: 36,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 51,
  column: 36,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 56,
  column: 36,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 56,
  column: 37,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 65,
  column: 35,
}, {
  file: "tests/lint-fixtures/react/dependency-completeness.tsx",
  ruleId: reactExhaustiveDependenciesRule,
  messageId: null,
  line: 74,
  column: 38,
}], failures(reactOracleResults));
assertSuggestionContract(
  "React exhaustive-deps actual oracle",
  suggestionContract(reactOracleResults, reactExhaustiveDependenciesRule),
  [
    { line: 10, column: 6, suggestions: ["[count, props.step]"] },
    { line: 18, column: 44, suggestions: [] },
    { line: 18, column: 44, suggestions: ["[props.step]"] },
    { line: 25, column: 13, suggestions: [] },
    { line: 33, column: 3, suggestions: [] },
    { line: 38, column: 35, suggestions: ["[]"] },
    { line: 46, column: 36, suggestions: ["[props.value]"] },
    { line: 51, column: 36, suggestions: ["[props.value]"] },
    { line: 56, column: 36, suggestions: ["[props.value]"] },
    { line: 56, column: 37, suggestions: [] },
    { line: 65, column: 35, suggestions: ["[change]"] },
    { line: 74, column: 38, suggestions: ["[setValue]"] },
  ],
);

const validResults = await eslint.lintFiles(["tests/lint-fixtures/valid"]);
const validFailures = failures(validResults);
assertExactDiagnostics("Valid Behavon Hook fixture", [], validFailures);

const invalidResults = await eslint.lintFiles(["tests/lint-fixtures/invalid"]);
const invalidFailures = failures(invalidResults);
assertExactDiagnostics("Invalid Behavon Hook fixture", expectedInvalidDiagnostics, invalidFailures);
const dependencyFixtureResult = invalidResults.filter((result) =>
  result.filePath.endsWith("dependency-completeness.ts")
);
assertSuggestionContract(
  "Behavon dependency completeness",
  suggestionContract(dependencyFixtureResult, exhaustiveDependenciesRule),
  [
    { line: 11, column: 59, suggestions: ["[count, input.step]"] },
    { line: 16, column: 46, suggestions: ["[]"] },
    { line: 21, column: 46, suggestions: [] },
    { line: 21, column: 46, suggestions: [] },
    { line: 29, column: 39, suggestions: [] },
    { line: 29, column: 39, suggestions: [] },
    { line: 35, column: 17, suggestions: [] },
    { line: 37, column: 20, suggestions: [] },
    { line: 42, column: 52, suggestions: [] },
    { line: 42, column: 53, suggestions: [] },
    { line: 47, column: 52, suggestions: ["[]"] },
    { line: 52, column: 42, suggestions: ["[]"] },
    { line: 53, column: 57, suggestions: ["[]"] },
    { line: 59, column: 17, suggestions: [] },
    { line: 64, column: 17, suggestions: [] },
    { line: 71, column: 13, suggestions: [] },
    { line: 82, column: 6, suggestions: ["[customCommand, user.id]"] },
    { line: 92, column: 37, suggestions: ["[change]"] },
    { line: 99, column: 40, suggestions: ["[setValue]"] },
  ],
);

console.log(
  `Hook authoring lint contract passed: ${validResults.length} valid, ` +
  `${invalidFailures.length} exact invalid diagnostics; React actual and oracle mutation probes passed.`,
);
