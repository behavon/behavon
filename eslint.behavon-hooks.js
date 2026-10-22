export const behavonPublicHookNames = Object.freeze([
  "useState",
  "useLabelState",
  "useReducer",
  "useMutable",
  "useMemo",
  "useCallback",
  "useEffect",
  "useFuture",
  "useResource",
  "useSyncExternalStore",
  "useSignal",
  "useSlot",
  "useExport",
  "useModel",
  "usePort",
  "useConnect",
  "useSnapshot",
]);

const publicHooks = new Set(behavonPublicHookNames);
const valueHooks = new Set(["useState", "useLabelState", "useReducer", "useMutable", "useMemo", "useCallback", "useModel", "usePort", "useFuture", "useResource"]);
const customHookName = /^use[A-Z0-9]/;
const modelName = /^[A-Z]/;
const functionTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);
const mutatingMethods = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
]);
const collectionMutatingMethods = new Set([
  ...mutatingMethods,
  "add",
  "clear",
  "delete",
  "set",
]);

function memberName(node) {
  if (node.type !== "MemberExpression") return undefined;
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  if (node.computed && (node.property.type === "Literal" || node.property.type === "StringLiteral")) {
    return typeof node.property.value === "string" ? node.property.value : undefined;
  }
  return undefined;
}

function staticallyKnownString(sourceCode, node, resolving = new Set()) {
  const current = innerExpression(node);
  if (
    (current.type === "Literal" || current.type === "StringLiteral") &&
    typeof current.value === "string"
  ) return current.value;
  if (current.type === "BinaryExpression" && current.operator === "+") {
    const left = staticallyKnownString(sourceCode, current.left, resolving);
    if (left === undefined) return undefined;
    const right = staticallyKnownString(sourceCode, current.right, resolving);
    return right === undefined ? undefined : left + right;
  }
  if (current.type === "TemplateLiteral") {
    let value = current.quasis[0]?.value.cooked;
    if (value === null || value === undefined) return undefined;
    for (let index = 0; index < current.expressions.length; index += 1) {
      const expression = staticallyKnownString(sourceCode, current.expressions[index], resolving);
      const quasi = current.quasis[index + 1]?.value.cooked;
      if (expression === undefined || quasi === null || quasi === undefined) return undefined;
      value += expression + quasi;
    }
    return value;
  }
  if (current.type !== "Identifier") return undefined;
  const variable = resolvedVariable(sourceCode, current);
  if (variable === undefined || resolving.has(variable)) return undefined;
  const definitions = variable.defs.filter((definition) => definition.type === "Variable");
  if (definitions.length !== 1 || variable.defs.length !== 1) return undefined;
  const definition = definitions[0];
  const declaration = definition.parent ?? definition.node.parent;
  if (
    declaration?.type !== "VariableDeclaration" ||
    declaration.kind !== "const" ||
    definition.node.type !== "VariableDeclarator" ||
    definition.node.id.type !== "Identifier" ||
    definition.node.init === null ||
    definition.node.init === undefined
  ) return undefined;
  resolving.add(variable);
  const value = staticallyKnownString(sourceCode, definition.node.init, resolving);
  resolving.delete(variable);
  return value;
}

function staticallyKnownMemberName(sourceCode, node) {
  if (node.type !== "MemberExpression") return undefined;
  return node.computed
    ? staticallyKnownString(sourceCode, node.property)
    : memberName(node);
}

function importedBinding(sourceCode, identifier) {
  if (identifier.type !== "Identifier") return undefined;
  let scope = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) {
      const definition = variable.defs.find((candidate) => candidate.type === "ImportBinding");
      const declaration = definition?.parent ?? definition?.node?.parent;
      if (definition === undefined || declaration?.source?.value !== "behavon") return undefined;
      const specifier = definition.node;
      if (specifier.type === "ImportNamespaceSpecifier") return { kind: "namespace", specifier };
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported.name ?? specifier.imported.value;
        if (imported === "default") return { kind: "default", specifier };
        return { kind: "named", imported, specifier };
      }
      return { kind: "default", specifier };
    }
    scope = scope.upper;
  }
  return undefined;
}

function isBehavonFacadeBinding(binding) {
  return binding?.kind === "namespace" || binding?.kind === "default";
}

function publicHookCallName(sourceCode, call) {
  const callee = call.callee;
  if (callee.type === "Identifier") {
    const binding = importedBinding(sourceCode, callee);
    return binding?.kind === "named" && publicHooks.has(binding.imported)
      ? binding.imported
      : undefined;
  }
  if (callee.type !== "MemberExpression") return undefined;
  const object = innerExpression(callee.object);
  if (object.type !== "Identifier") return undefined;
  const binding = importedBinding(sourceCode, object);
  const name = staticallyKnownMemberName(sourceCode, callee);
  return isBehavonFacadeBinding(binding) && name !== undefined && publicHooks.has(name)
    ? name
    : undefined;
}

function canonicalPublicHookCallName(sourceCode, call) {
  const callee = call.callee;
  if (callee.type === "Identifier") {
    const binding = importedBinding(sourceCode, callee);
    return binding?.kind === "named" &&
      publicHooks.has(binding.imported) &&
      customHookName.test(callee.name)
      ? binding.imported
      : undefined;
  }
  if (
    callee.type !== "MemberExpression" ||
    callee.computed ||
    callee.optional ||
    callee.object.type !== "Identifier" ||
    callee.object.name !== "Behavon"
  ) return undefined;
  const binding = importedBinding(sourceCode, callee.object);
  const name = memberName(callee);
  return isBehavonFacadeBinding(binding) && name !== undefined && publicHooks.has(name)
    ? name
    : undefined;
}

function functionOwnerName(node) {
  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
    if (node.id?.type === "Identifier") return node.id.name;
  }
  const parent = node.parent;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
  if (parent?.type === "AssignmentExpression" && parent.left.type === "Identifier") return parent.left.name;
  if (
    (parent?.type === "Property" || parent?.type === "PropertyDefinition") &&
    !parent.computed &&
    parent.key.type === "Identifier"
  ) return parent.key.name;
  return undefined;
}

function containingFunction(node) {
  for (let parent = node.parent; parent !== null && parent !== undefined; parent = parent.parent) {
    if (
      parent.type === "ArrowFunctionExpression" ||
      parent.type === "FunctionExpression" ||
      parent.type === "FunctionDeclaration"
    ) return parent;
  }
  return undefined;
}

function isFunction(node) {
  return node !== null && node !== undefined && functionTypes.has(node.type);
}

function walk(sourceCode, root, visit, includeNestedFunctions = true) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node !== root && !includeNestedFunctions && isFunction(node)) continue;
    visit(node);
    const keys = sourceCode.visitorKeys[node.type] ?? [];
    for (let keyIndex = keys.length - 1; keyIndex >= 0; keyIndex -= 1) {
      const value = node[keys[keyIndex]];
      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index -= 1) {
          if (value[index]?.type !== undefined) stack.push(value[index]);
        }
      } else if (value?.type !== undefined) {
        stack.push(value);
      }
    }
  }
}

function functionName(node) {
  return functionOwnerName(node);
}

function variableFunction(sourceCode, identifier) {
  const variable = resolvedVariable(sourceCode, identifier);
  if (variable === undefined) return undefined;
  for (const definition of variable.defs) {
    if (definition.type === "FunctionName" && definition.node.type === "FunctionDeclaration") {
      return definition.node;
    }
    if (definition.type === "Variable" && definition.node.type === "VariableDeclarator") {
      const initializer = definition.node.init === null || definition.node.init === undefined
        ? undefined
        : innerExpression(definition.node.init);
      if (isFunction(initializer)) return initializer;
    }
  }
  return undefined;
}

function directBehavonCallName(sourceCode, call) {
  const callee = innerExpression(call.callee);
  if (callee.type === "Identifier") {
    const binding = importedBinding(sourceCode, callee);
    return binding?.kind === "named" ? binding.imported : undefined;
  }
  if (
    callee.type !== "MemberExpression" ||
    callee.computed ||
    callee.object.type !== "Identifier"
  ) return undefined;
  const binding = importedBinding(sourceCode, callee.object);
  return isBehavonFacadeBinding(binding) ? memberName(callee) : undefined;
}

function patternVariables(sourceCode, pattern) {
  const identifiers = [];
  patternIdentifiers(pattern, identifiers);
  return identifiers.map((identifier) => resolvedVariable(sourceCode, identifier)).filter(Boolean);
}

function rootIdentifier(node) {
  let current = innerExpression(node);
  while (current.type === "MemberExpression") current = innerExpression(current.object);
  return current.type === "Identifier" ? current : undefined;
}

function declaredInside(variable, owner) {
  return variable?.defs.some((definition) => {
    const node = definition.node;
    return node.range[0] >= owner.range[0] && node.range[1] <= owner.range[1];
  }) ?? false;
}

function memberPath(node) {
  const current = innerExpression(node);
  if (current.type === "Identifier") return [current.name];
  if (current.type !== "MemberExpression" || current.computed) return undefined;
  const left = memberPath(current.object);
  const right = memberName(current);
  return left === undefined || right === undefined ? undefined : [...left, right];
}

function isDirectFunctionReturn(call, owner) {
  if (owner.type === "ArrowFunctionExpression" && owner.body.type !== "BlockStatement") return true;
  for (let parent = call.parent; parent !== null && parent !== undefined && parent !== owner; parent = parent.parent) {
    if (parent.type === "ReturnStatement") return true;
  }
  return false;
}

function isDiscardedExpressionValue(call) {
  let current = call;
  for (;;) {
    const parent = current.parent;
    if (parent === null || parent === undefined) return false;
    if (
      parent.type === "TSAsExpression" ||
      parent.type === "TSTypeAssertion" ||
      parent.type === "TSSatisfiesExpression" ||
      parent.type === "TSNonNullExpression" ||
      parent.type === "ChainExpression" ||
      parent.type === "ParenthesizedExpression"
    ) {
      current = parent;
      continue;
    }
    if (parent.type === "UnaryExpression" && parent.operator === "void") return true;
    if (parent.type === "SequenceExpression") {
      if (parent.expressions.at(-1) !== current) return true;
      current = parent;
      continue;
    }
    return parent.type === "ExpressionStatement";
  }
}

function transparentExpression(node) {
  return node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "ChainExpression" ||
    node.type === "ParenthesizedExpression";
}

function outerExpression(node) {
  let current = node;
  while (current.parent !== null && current.parent !== undefined && transparentExpression(current.parent)) {
    current = current.parent;
  }
  return current;
}

function innerExpression(node) {
  let current = node;
  while (transparentExpression(current)) current = current.expression;
  return current;
}

function isIndependentHookUse(call) {
  const current = outerExpression(call);
  const parent = current.parent;
  if (parent?.type === "VariableDeclarator") return parent.init === current;
  if (parent?.type === "AssignmentExpression") return parent.right === current;
  return parent?.type === "ExpressionStatement" && parent.expression === current;
}

function isDiscardedReference(identifier) {
  let current = outerExpression(identifier);
  for (;;) {
    if (
      current.parent?.type === "MemberExpression" &&
      current.parent.object === current
    ) {
      current = outerExpression(current.parent);
      continue;
    }
    if (current.parent?.type === "SequenceExpression") {
      if (current.parent.expressions.at(-1) !== current) return true;
      current = outerExpression(current.parent);
      continue;
    }
    if (current.parent?.type === "ExpressionStatement") return true;
    return current.parent?.type === "UnaryExpression" && current.parent.operator === "void";
  }
}

function isDiscardedVariableValue(sourceCode, call) {
  const current = outerExpression(call);
  const declaration = current.parent;
  if (declaration?.type !== "VariableDeclarator" || declaration.init !== current) return false;
  const variables = sourceCode.getDeclaredVariables(declaration);
  if (variables.length === 0) return true;
  return variables.every((variable) => variable.references.every(
    (reference) => !reference.isRead() || isDiscardedReference(reference.identifier),
  ));
}

function patternIdentifiers(pattern, identifiers) {
  if (pattern.type === "Identifier") {
    identifiers.push(pattern);
    return true;
  }
  if (pattern.type === "ArrayPattern") {
    return pattern.elements.every((element) => element === null || patternIdentifiers(element, identifiers));
  }
  if (pattern.type === "ObjectPattern") {
    return pattern.properties.every((property) => patternIdentifiers(
      property.type === "RestElement" ? property.argument : property.value,
      identifiers,
    ));
  }
  if (pattern.type === "AssignmentPattern") return patternIdentifiers(pattern.left, identifiers);
  if (pattern.type === "RestElement") return patternIdentifiers(pattern.argument, identifiers);
  return false;
}

function resolvedVariable(sourceCode, identifier) {
  let scope = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return undefined;
}

function isDiscardedAssignmentValue(sourceCode, call) {
  const current = outerExpression(call);
  const assignment = current.parent;
  if (assignment?.type !== "AssignmentExpression" || assignment.right !== current) return false;
  const identifiers = [];
  if (!patternIdentifiers(assignment.left, identifiers)) return false;
  if (identifiers.length === 0) return true;
  return identifiers.every((identifier) => {
    const variable = resolvedVariable(sourceCode, identifier);
    if (variable === undefined) return false;
    return variable.references.every(
      (reference) => !reference.isRead() || isDiscardedReference(reference.identifier),
    );
  });
}

function isHookCall(sourceCode, call) {
  if (publicHookCallName(sourceCode, call) !== undefined) return true;
  const callee = call.callee;
  if (callee.type === "Identifier") return customHookName.test(callee.name);
  if (callee.type !== "MemberExpression") return false;
  const name = memberName(callee);
  return name !== undefined && customHookName.test(name);
}

function isInsideTry(node) {
  for (let parent = node.parent; parent !== null && parent !== undefined; parent = parent.parent) {
    if (parent.type === "TryStatement") return true;
  }
  return false;
}

function nestedPublicHookCall(sourceCode, node) {
  for (let parent = node.parent; parent !== null && parent !== undefined; parent = parent.parent) {
    if (
      parent.type === "ArrowFunctionExpression" ||
      parent.type === "FunctionExpression" ||
      parent.type === "FunctionDeclaration"
    ) return undefined;
    if (parent.type !== "CallExpression") continue;
    if (publicHookCallName(sourceCode, parent) !== undefined) return parent;
  }
  return undefined;
}

const canonicalApiRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      namespaceName: "The 'behavon' namespace import must use the exact local name 'Behavon'.",
      defaultName: "The default 'behavon' import must use the exact local name 'Behavon'.",
      namedHookAlias: "A named Behavon Hook import must keep a local name matching use[A-Z0-9].",
      computedNamespaceMember: "Access the Behavon facade through a non-computed direct member such as Behavon.useState or Behavon.createModel.",
      wrappedNamespaceHook: "Call Behavon public Hooks through the direct Behavon facade without casts or wrappers.",
      optionalHook: "Do not optional-chain Behavon public Hooks; call the direct Behavon Hook member.",
      extractedHook: "Do not destructure or extract Behavon public Hooks; call the facade member directly.",
      directNamedHook: "Call a named Behavon Hook import directly instead of extracting or passing it.",
      namespaceAlias: "Do not copy the Behavon facade; call public Hooks through the direct Behavon import.",
      hookReexport: "Do not re-export Behavon public Hooks through a wrapper module; import them directly from behavon.",
      tryHook: "Hooks matching Behavon public names or use[A-Z0-9] cannot be called inside try/catch/finally.",
      nestedEndpointHook: "Declare each Hook in a separate top-level statement before passing its result to another Behavon Hook.",
      inlineHookResult: "Declare the Behavon Hook result in its own top-level local variable before using it in another expression.",
      directHookReturn: "Assign the Behavon Hook result to a local variable before returning it from a Model or custom Hook.",
      discardedValueHook: "Use the value returned by Behavon.{{name}}(...), or remove the Hook call.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "behavon") return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier" && specifier.local.name !== "Behavon") {
            context.report({ node: specifier.local, messageId: "defaultName" });
            continue;
          }
          if (specifier.type === "ImportNamespaceSpecifier" && specifier.local.name !== "Behavon") {
            context.report({ node: specifier.local, messageId: "namespaceName" });
            continue;
          }
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = specifier.imported.name ?? specifier.imported.value;
          if (imported === "default") {
            if (specifier.local.name !== "Behavon") {
              context.report({ node: specifier.local, messageId: "defaultName" });
            }
          } else if (publicHooks.has(imported) && !customHookName.test(specifier.local.name)) {
            context.report({ node: specifier.local, messageId: "namedHookAlias" });
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source?.value !== "behavon") return;
        for (const specifier of node.specifiers) {
          const local = specifier.local?.name ?? specifier.local?.value;
          if (local === "default" || publicHooks.has(local)) {
            context.report({ node: specifier, messageId: "hookReexport" });
          }
        }
      },
      ExportAllDeclaration(node) {
        if (node.source.value === "behavon") context.report({ node, messageId: "hookReexport" });
      },
      MemberExpression(node) {
        const object = innerExpression(node.object);
        if (object.type !== "Identifier") return;
        const binding = importedBinding(sourceCode, object);
        if (!isBehavonFacadeBinding(binding)) return;
        if (node.computed) {
          context.report({ node, messageId: "computedNamespaceMember" });
          return;
        }
        const name = staticallyKnownMemberName(sourceCode, node);
        if (binding?.kind === "namespace" && name === "default") {
          context.report({ node, messageId: "namespaceAlias" });
          return;
        }
        if (name === undefined || !publicHooks.has(name)) return;
        if (node.object.type !== "Identifier") {
          context.report({ node, messageId: "wrappedNamespaceHook" });
          return;
        }
        if (
          node.optional ||
          (node.parent?.type === "CallExpression" && node.parent.callee === node && node.parent.optional)
        ) {
          context.report({ node, messageId: "optionalHook" });
          return;
        }
        if (node.parent?.type !== "CallExpression" || node.parent.callee !== node || node.parent.optional) {
          context.report({ node, messageId: "extractedHook" });
        }
      },
      VariableDeclarator(node) {
        const init = node.init === null || node.init === undefined ? undefined : innerExpression(node.init);
        if (
          node.id.type === "Identifier" &&
          init?.type === "Identifier" &&
          isBehavonFacadeBinding(importedBinding(sourceCode, init))
        ) {
          context.report({ node, messageId: "namespaceAlias" });
        }
        if (
          node.id.type !== "ObjectPattern" ||
          node.init?.type !== "Identifier" ||
          !isBehavonFacadeBinding(importedBinding(sourceCode, node.init))
        ) return;
        for (const property of node.id.properties) {
          if (property.type === "RestElement") {
            context.report({ node: property, messageId: "namespaceAlias" });
            continue;
          }
          if (property.computed) {
            context.report({ node: property, messageId: "computedNamespaceMember" });
            continue;
          }
          const name = property.key.name ?? property.key.value;
          if (name === "default") context.report({ node: property, messageId: "namespaceAlias" });
          else if (publicHooks.has(name)) context.report({ node: property, messageId: "extractedHook" });
        }
      },
      AssignmentExpression(node) {
        const right = innerExpression(node.right);
        if (
          right.type === "Identifier" &&
          isBehavonFacadeBinding(importedBinding(sourceCode, right))
        ) {
          context.report({ node, messageId: "namespaceAlias" });
        }
      },
      Identifier(node) {
        const binding = importedBinding(sourceCode, node);
        if (isBehavonFacadeBinding(binding)) {
          if (
            node.parent?.type === "ImportNamespaceSpecifier" ||
            node.parent?.type === "ImportDefaultSpecifier" ||
            node.parent?.type === "ImportSpecifier"
          ) return;
          if (node.parent?.type === "Property" && node.parent.shorthand && node.parent.key === node) return;
          if (node.parent?.type === "MemberExpression" && node.parent.object === node) return;
          if (node.parent?.type === "TSQualifiedName" && node.parent.left === node) return;
          if (node.parent?.type === "TSTypeQuery") return;
          const current = outerExpression(node);
          if (current.parent?.type === "MemberExpression" && current.parent.object === current) return;
          if (
            current.parent?.type === "BinaryExpression" &&
            current.parent.operator === "in" &&
            current.parent.right === current
          ) return;
          if (current.parent?.type === "UnaryExpression" && current.parent.operator === "typeof") return;
          if (
            (current.parent?.type === "VariableDeclarator" && current.parent.init === current) ||
            (current.parent?.type === "AssignmentExpression" && current.parent.right === current)
          ) return;
          context.report({ node, messageId: "namespaceAlias" });
          return;
        }
        if (binding?.kind === "named" && publicHooks.has(binding.imported)) {
          if (node.parent?.type === "ImportSpecifier") return;
          if (
            node.parent?.type === "MemberExpression" &&
            node.parent.property === node &&
            !node.parent.computed
          ) return;
          if (
            node.parent?.type === "Property" &&
            node.parent.key === node &&
            !node.parent.computed &&
            !node.parent.shorthand
          ) return;
          if (node.parent?.type !== "CallExpression" || node.parent.callee !== node || node.parent.optional) {
            context.report({ node, messageId: "directNamedHook" });
          }
        }
      },
      CallExpression(node) {
        if (!isHookCall(sourceCode, node)) return;
        if (isInsideTry(node)) context.report({ node, messageId: "tryHook" });
        const nestedHook = nestedPublicHookCall(sourceCode, node);
        if (nestedHook !== undefined) {
          context.report({ node, messageId: "nestedEndpointHook" });
        }
        const canonicalName = canonicalPublicHookCallName(sourceCode, node);
        if (canonicalName === undefined) return;
        const owner = containingFunction(node);
        const ownerName = owner === undefined ? undefined : functionOwnerName(owner);
        const authoredOwner = ownerName !== undefined &&
          (modelName.test(ownerName) || customHookName.test(ownerName));
        const directReturn = owner !== undefined && authoredOwner && isDirectFunctionReturn(node, owner);
        if (
          directReturn
        ) {
          context.report({ node, messageId: "directHookReturn" });
        } else if (authoredOwner && nestedHook === undefined && !isIndependentHookUse(node)) {
          context.report({ node, messageId: "inlineHookResult" });
        }
        if (
          valueHooks.has(canonicalName) &&
          (
            isDiscardedExpressionValue(node) ||
            isDiscardedVariableValue(sourceCode, node) ||
            isDiscardedAssignmentValue(sourceCode, node)
          )
        ) {
          context.report({
            node,
            messageId: "discardedValueHook",
            data: { name: canonicalName },
          });
        }
      },
    };
  },
};

const staticModelDefinitionRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      inlineModelDefinition: "Define the Model as a static module-scope function before passing it to Behavon.{{api}}.",
      dynamicModelDefinition: "Do not pass a Model defined inside another function to Behavon.{{api}}; move the Model definition to module scope.",
      dynamicModelFactory: "Pass a static Model reference to Behavon.{{api}} instead of creating or selecting a Model during the call.",
      dynamicPortDefinition: "Declare Behavon.createPort<Port>(...) at module scope so its identity and Model contract stay static.",
      dynamicResourceDefinition: "Declare Behavon.createResource(...) at module scope so its adapter identity stays static.",
      missingPortDescriptor: "Model<..., {{port}}> must register its public members through one module-scope Behavon.createPort<{{port}}>(...) descriptor.",
      missingModelPort: "A Model using Behavon.createPort<{{port}}>(...) must declare the same Port as its third Model type argument.",
      mismatchedPortDescriptor: "Model Port '{{modelPort}}' does not match the used createPort descriptor contract '{{descriptorPort}}'.",
      mixedPortDescriptors: "One Model cannot register public members from multiple createPort descriptors.",
      nonInlinePortDeclaration: "Pass an inline object literal to Behavon.createPort<Port>(...) so the exact runtime declaration can be statically verified.",
      reservedPortMemberName: "Behavon.createPort declarations cannot use an empty top-level member name or the reserved '__proto__' name.",
      indirectPortDefinition: "Use a canonical Behavon.createPort<Port>(...) or named createPort<Port>(...) direct call; do not extract, wrap, re-export, or dynamically load createPort.",
      indirectResourceDefinition: "Use a canonical Behavon.createResource(...) or named createResource(...) direct call; do not extract, wrap, re-export, or dynamically load createResource.",
      nonPreservingModelType: "Use an explicit Model<Input, Output, Port> annotation on the provider variable or contextual container member; satisfies checks assignability but does not carry the Model Port into createModel inference.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const typeAliases = new Map();
    const interfaces = new Map();
    const pendingCreateModelCalls = [];
    const pendingSatisfiesExpressions = [];

    function resolveTypeAlias(node, resolving = new Set()) {
      if (node?.type !== "TSTypeReference" || node.typeName.type !== "Identifier") return node;
      const parameters = typeParameters(node);
      if (parameters.length > 0 || resolving.has(node.typeName.name)) return node;
      const alias = typeAliases.get(node.typeName.name);
      if (alias === undefined) return node;
      resolving.add(node.typeName.name);
      const resolved = resolveTypeAlias(alias, resolving);
      resolving.delete(node.typeName.name);
      return resolved;
    }

    function directModelTypeReference(node) {
      const current = resolveTypeAlias(node);
      if (current?.type !== "TSTypeReference") return undefined;
      const name = current.typeName;
      if (name.type === "Identifier") {
        const binding = importedBinding(sourceCode, name);
        return binding?.kind === "named" && binding.imported === "Model" ? current : undefined;
      }
      if (
        name.type !== "TSQualifiedName" ||
        name.left.type !== "Identifier" ||
        name.right.type !== "Identifier" ||
        name.right.name !== "Model"
      ) return undefined;
      return isBehavonFacadeBinding(importedBinding(sourceCode, name.left)) ? current : undefined;
    }

    function objectTypeBody(node, resolving = new Set()) {
      if (node?.type === "TSTypeLiteral") return node.members;
      if (node?.type === "TSIntersectionType") {
        return node.types.slice().reverse().flatMap((member) =>
          objectTypeBody(member, resolving) ?? []
        );
      }
      if (
        node?.type !== "TSTypeReference" ||
        node.typeName.type !== "Identifier" ||
        typeParameters(node).length > 0 ||
        resolving.has(node.typeName.name)
      ) return undefined;
      const name = node.typeName.name;
      resolving.add(name);
      const alias = typeAliases.get(name);
      if (alias !== undefined) {
        const body = objectTypeBody(alias, resolving);
        resolving.delete(name);
        return body;
      }
      const declaration = interfaces.get(name);
      if (declaration === undefined) {
        resolving.delete(name);
        return undefined;
      }
      const inherited = declaration.extends.flatMap((extension) => {
        if (
          extension.expression.type !== "Identifier" ||
          typeParameters(extension).length > 0
        ) return [];
        const reference = {
          type: "TSTypeReference",
          typeName: extension.expression,
        };
        return objectTypeBody(reference, resolving) ?? [];
      });
      resolving.delete(name);
      return [...declaration.body.body, ...inherited];
    }

    function objectMemberModelType(node, key) {
      const body = objectTypeBody(node);
      if (body === undefined) return undefined;
      const member = body.find((candidate) =>
        candidate.type === "TSPropertySignature" &&
        !candidate.optional &&
        staticPropertyKey(candidate.key, candidate.computed) === key
      );
      return member?.type === "TSPropertySignature"
        ? directModelTypeReference(member.typeAnnotation?.typeAnnotation)
        : undefined;
    }

    function objectModelMemberKeys(node) {
      const body = objectTypeBody(node);
      if (body === undefined) return [];
      return body.flatMap((member) => {
        if (member.type !== "TSPropertySignature" || member.optional) return [];
        const key = staticPropertyKey(member.key, member.computed);
        return key !== undefined && objectMemberModelType(node, key) !== undefined ? [key] : [];
      });
    }

    function tupleElementType(node) {
      let current = node;
      if (current?.type === "TSNamedTupleMember") current = current.elementType;
      if (current?.type === "TSOptionalType" || current?.type === "TSRestType") return undefined;
      return current;
    }

    function unwrapReadonlyType(node) {
      let current = resolveTypeAlias(node);
      while (current?.type === "TSTypeOperator" && current.operator === "readonly") {
        current = resolveTypeAlias(current.typeAnnotation);
      }
      return current;
    }

    function arrayElementModelType(node, index) {
      const current = unwrapReadonlyType(node);
      if (current?.type === "TSArrayType") {
        return directModelTypeReference(current.elementType);
      }
      if (
        current?.type === "TSTypeReference" &&
        current.typeName.type === "Identifier" &&
        (current.typeName.name === "Array" || current.typeName.name === "ReadonlyArray")
      ) {
        return directModelTypeReference(typeParameters(current)[0]);
      }
      if (current?.type !== "TSTupleType") return undefined;
      return directModelTypeReference(tupleElementType(current.elementTypes[index]));
    }

    function arrayModelElementIndices(node, expression) {
      const initializer = innerExpression(expression);
      if (initializer.type !== "ArrayExpression") return [];
      const indices = [];
      for (let index = 0; index < initializer.elements.length; index += 1) {
        if (arrayElementModelType(node, index) !== undefined) indices.push(index);
      }
      return indices;
    }

    function modelType(declarator) {
      if (declarator.id.type === "Identifier") {
        const annotation = directModelTypeReference(declarator.id.typeAnnotation?.typeAnnotation);
        if (annotation !== undefined) return annotation;
      }
      let initializer = declarator.init;
      while (initializer !== null && initializer !== undefined && transparentExpression(initializer)) {
        if (
          initializer.type === "TSAsExpression" ||
          initializer.type === "TSTypeAssertion" ||
          initializer.type === "TSSatisfiesExpression"
        ) {
          const annotation = directModelTypeReference(initializer.typeAnnotation);
          if (annotation !== undefined) return annotation;
        }
        initializer = initializer.expression;
      }
      return undefined;
    }

    function typeParameters(node) {
      return node.typeParameters?.params ?? node.typeArguments?.params ?? [];
    }

    function typeText(node) {
      const resolved = resolveTypeAlias(node);
      return resolved === undefined ? undefined : sourceCode.getText(resolved).replace(/\s+/g, "");
    }

    function createPortFactory(node, resolving = new Set()) {
      const current = innerExpression(node);
      if (current.type === "MemberExpression") {
        const object = innerExpression(current.object);
        return object.type === "Identifier" &&
          isBehavonFacadeBinding(importedBinding(sourceCode, object)) &&
          staticallyKnownMemberName(sourceCode, current) === "createPort"
          ? { indirect: false }
          : undefined;
      }
      if (current.type !== "Identifier") return undefined;
      const binding = importedBinding(sourceCode, current);
      if (binding?.kind === "named" && binding.imported === "createPort") {
        return { indirect: false };
      }
      const variable = resolvedVariable(sourceCode, current);
      if (variable === undefined || resolving.has(variable)) return undefined;
      const declaration = variableDeclarator(variable);
      if (declaration?.init === null || declaration?.init === undefined) return undefined;
      resolving.add(variable);
      const factory = createPortFactory(declaration.init, resolving);
      resolving.delete(variable);
      return factory === undefined ? undefined : { indirect: true };
    }

    function behavonCreatePortMember(node) {
      if (node.type !== "MemberExpression") return false;
      const object = innerExpression(node.object);
      return object.type === "Identifier" &&
        isBehavonFacadeBinding(importedBinding(sourceCode, object)) &&
        staticallyKnownMemberName(sourceCode, node) === "createPort";
    }

    function namedCreatePortReference(node) {
      if (node.type !== "Identifier") return false;
      const binding = importedBinding(sourceCode, node);
      return binding?.kind === "named" && binding.imported === "createPort";
    }

    function createResourceFactory(node, resolving = new Set()) {
      const current = innerExpression(node);
      if (current.type === "MemberExpression") {
        const object = innerExpression(current.object);
        return object.type === "Identifier" &&
          isBehavonFacadeBinding(importedBinding(sourceCode, object)) &&
          staticallyKnownMemberName(sourceCode, current) === "createResource"
          ? { indirect: false }
          : undefined;
      }
      if (current.type !== "Identifier") return undefined;
      const binding = importedBinding(sourceCode, current);
      if (binding?.kind === "named" && binding.imported === "createResource") return { indirect: false };
      const variable = resolvedVariable(sourceCode, current);
      if (variable === undefined || resolving.has(variable)) return undefined;
      const declaration = variableDeclarator(variable);
      if (declaration?.init === null || declaration?.init === undefined) return undefined;
      resolving.add(variable);
      const factory = createResourceFactory(declaration.init, resolving);
      resolving.delete(variable);
      return factory === undefined ? undefined : { indirect: true };
    }

    function behavonCreateResourceMember(node) {
      if (node.type !== "MemberExpression") return false;
      const object = innerExpression(node.object);
      return object.type === "Identifier" &&
        isBehavonFacadeBinding(importedBinding(sourceCode, object)) &&
        staticallyKnownMemberName(sourceCode, node) === "createResource";
    }

    function namedCreateResourceReference(node) {
      if (node.type !== "Identifier") return false;
      const binding = importedBinding(sourceCode, node);
      return binding?.kind === "named" && binding.imported === "createResource";
    }

    function directCreateResourceCallee(node) {
      const parent = node.parent;
      if (parent?.type !== "CallExpression" || parent.callee !== node || parent.optional) return false;
      if (node.type === "Identifier") return namedCreateResourceReference(node);
      return behavonCreateResourceMember(node) && !node.computed && !node.optional;
    }

    function destructuredCreateResourceProperties(node) {
      if (node.type !== "VariableDeclarator" || node.id.type !== "ObjectPattern") return [];
      const initializer = node.init === null ? undefined : innerExpression(node.init);
      if (initializer?.type !== "Identifier" || !isBehavonFacadeBinding(importedBinding(sourceCode, initializer))) return [];
      return node.id.properties.filter((property) => {
        if (property.type !== "Property") return false;
        const name = !property.computed && property.key.type === "Identifier"
          ? property.key.name
          : staticallyKnownString(sourceCode, property.key);
        return name === "createResource";
      });
    }

    function directCreatePortCallee(node) {
      const parent = node.parent;
      if (parent?.type !== "CallExpression" || parent.callee !== node || parent.optional) return false;
      if (node.type === "Identifier") return namedCreatePortReference(node);
      return behavonCreatePortMember(node) && !node.computed && !node.optional;
    }

    function destructuredCreatePortProperties(node) {
      if (node.type !== "VariableDeclarator" || node.id.type !== "ObjectPattern") return [];
      const initializer = node.init === null ? undefined : innerExpression(node.init);
      if (
        initializer?.type !== "Identifier" ||
        !isBehavonFacadeBinding(importedBinding(sourceCode, initializer))
      ) return [];
      return node.id.properties.filter((property) => {
        if (property.type !== "Property") return false;
        const name = !property.computed && property.key.type === "Identifier"
          ? property.key.name
          : staticallyKnownString(sourceCode, property.key);
        return name === "createPort";
      });
    }

    function createPortInvocation(call) {
      const factory = createPortFactory(call.callee);
      return factory === undefined ? undefined : { call, ...factory };
    }

    function directPortMarkerCall(node) {
      const current = innerExpression(node);
      if (current.type !== "CallExpression" || current.optional) return false;
      const callee = innerExpression(current.callee);
      if (callee.type === "Identifier") {
        const binding = importedBinding(sourceCode, callee);
        return binding?.kind === "named" &&
          (binding.imported === "SignalType" ||
            binding.imported === "SlotType" ||
            binding.imported === "SnapshotType");
      }
      if (
        callee.type !== "MemberExpression" ||
        callee.computed ||
        callee.optional ||
        callee.object.type !== "Identifier" ||
        !isBehavonFacadeBinding(importedBinding(sourceCode, callee.object))
      ) return false;
      const name = memberName(callee);
      return name === "SignalType" || name === "SlotType" || name === "SnapshotType";
    }

    function invalidPortDeclarationMember(node, root = true) {
      const current = innerExpression(node);
      if (current.type !== "ObjectExpression") {
        return !root && directPortMarkerCall(current) ? undefined : current;
      }
      for (const property of current.properties) {
        if (
          property.type !== "Property" ||
          property.computed ||
          property.method ||
          property.shorthand ||
          property.kind !== "init"
        ) return property;
        const invalid = invalidPortDeclarationMember(property.value, false);
        if (invalid !== undefined) return invalid;
      }
      return undefined;
    }

    function reservedPortDeclarationMember(node, root = true) {
      const current = innerExpression(node);
      if (current.type !== "ObjectExpression") return undefined;
      for (const property of current.properties) {
        if (property.type !== "Property") continue;
        const key = staticPropertyKey(property.key, property.computed);
        if (key === "__proto__" || (root && key === "")) return property.key;
        const invalid = reservedPortDeclarationMember(property.value, false);
        if (invalid !== undefined) return invalid;
      }
      return undefined;
    }

    function behavonModuleSource(node) {
      return staticallyKnownString(sourceCode, node) === "behavon";
    }

    function behavonRequireCall(node) {
      if (node.type !== "CallExpression") return false;
      const callee = innerExpression(node.callee);
      if (callee.type !== "Identifier" || callee.name !== "require") return false;
      if (resolvedVariable(sourceCode, callee) !== undefined) return false;
      const source = node.arguments[0];
      return source !== undefined && source.type !== "SpreadElement" && behavonModuleSource(source);
    }

    function importedVariable(variable) {
      return variable.defs.some((definition) => {
        if (definition.type !== "ImportBinding") return false;
        const declaration = definition.parent ?? definition.node?.parent;
        return declaration?.source?.value !== "behavon";
      });
    }

    function staticPropertyKey(node, computed) {
      if (!computed && node.type === "Identifier") return node.name;
      if (
        (node.type === "Literal" || node.type === "StringLiteral") &&
        (typeof node.value === "string" || typeof node.value === "number")
      ) return String(node.value);
      const value = staticallyKnownString(sourceCode, node);
      return value === undefined ? undefined : value;
    }

    function memberKey(node) {
      if (node.type !== "MemberExpression") return undefined;
      return staticPropertyKey(node.property, node.computed);
    }

    function carrierPropertyValue(node, key, resolving = new Set(), carrierBindings = new Map()) {
      const current = innerExpression(node);
      if (current.type === "Identifier") {
        const variable = resolvedVariable(sourceCode, current);
        if (variable === undefined || resolving.has(variable)) return undefined;
        const boundCarrier = carrierBindings.get(variable);
        if (boundCarrier !== undefined) {
          resolving.add(variable);
          const value = carrierPropertyValue(boundCarrier, key, resolving, carrierBindings);
          resolving.delete(variable);
          return value;
        }
        const declaration = variableDeclarator(variable);
        if (declaration?.init === null || declaration?.init === undefined) return undefined;
        resolving.add(variable);
        const source = declaration.id.type === "Identifier"
          ? declaration.init
          : bindingExpression(
              declaration.id,
              current.name,
              declaration.init,
              resolving,
              carrierBindings,
            );
        const value = source === undefined
          ? undefined
          : carrierPropertyValue(source, key, resolving, carrierBindings);
        resolving.delete(variable);
        return value;
      }
      if (current.type === "MemberExpression") {
        const member = carrierMemberValue(current, resolving, carrierBindings);
        return member === undefined
          ? undefined
          : carrierPropertyValue(member, key, resolving, carrierBindings);
      }
      if (current.type === "ObjectExpression") {
        for (let index = current.properties.length - 1; index >= 0; index -= 1) {
          const property = current.properties[index];
          if (
            property.type === "Property" &&
            property.kind === "init" &&
            staticPropertyKey(property.key, property.computed) === key
          ) return property.value;
        }
        return undefined;
      }
      if (current.type === "ArrayExpression" && /^(0|[1-9]\d*)$/.test(key)) {
        const element = current.elements[Number(key)];
        return element === null || element?.type === "SpreadElement" ? undefined : element;
      }
      return undefined;
    }

    function carrierMemberValue(node, resolving = new Set(), carrierBindings = new Map()) {
      const key = memberKey(node);
      return key === undefined
        ? undefined
        : carrierPropertyValue(node.object, key, resolving, carrierBindings);
    }

    function patternContains(pattern, name) {
      if (pattern.type === "Identifier") return pattern.name === name;
      if (pattern.type === "AssignmentPattern") return patternContains(pattern.left, name);
      if (pattern.type === "RestElement") return patternContains(pattern.argument, name);
      if (pattern.type === "ArrayPattern") {
        return pattern.elements.some((element) => element !== null && patternContains(element, name));
      }
      if (pattern.type === "ObjectPattern") {
        return pattern.properties.some((property) => patternContains(
          property.type === "RestElement" ? property.argument : property.value,
          name,
        ));
      }
      return false;
    }

    function bindingExpression(
      pattern,
      name,
      source,
      resolving = new Set(),
      carrierBindings = new Map(),
    ) {
      if (pattern.type === "Identifier") return pattern.name === name ? source : undefined;
      if (pattern.type === "AssignmentPattern") {
        if (!patternContains(pattern.left, name)) return undefined;
        return bindingExpression(
          pattern.left,
          name,
          source ?? pattern.right,
          resolving,
          carrierBindings,
        );
      }
      if (pattern.type === "RestElement") return undefined;
      if (pattern.type === "ObjectPattern") {
        for (const property of pattern.properties) {
          if (property.type !== "Property" || !patternContains(property.value, name)) continue;
          const key = staticPropertyKey(property.key, property.computed);
          if (key === undefined) return undefined;
          const value = source === undefined
            ? undefined
            : carrierPropertyValue(source, key, resolving, carrierBindings);
          return bindingExpression(property.value, name, value, resolving, carrierBindings);
        }
        return undefined;
      }
      if (pattern.type === "ArrayPattern") {
        for (let index = 0; index < pattern.elements.length; index += 1) {
          const element = pattern.elements[index];
          if (element === null || !patternContains(element, name)) continue;
          const value = source === undefined
            ? undefined
            : carrierPropertyValue(source, String(index), resolving, carrierBindings);
          return bindingExpression(element, name, value, resolving, carrierBindings);
        }
      }
      return undefined;
    }

    function collectBindingIdentifiers(pattern, identifiers = []) {
      if (pattern.type === "Identifier") identifiers.push(pattern);
      else if (pattern.type === "AssignmentPattern") collectBindingIdentifiers(pattern.left, identifiers);
      else if (pattern.type === "RestElement") collectBindingIdentifiers(pattern.argument, identifiers);
      else if (pattern.type === "ArrayPattern") {
        for (const element of pattern.elements) {
          if (element !== null) collectBindingIdentifiers(element, identifiers);
        }
      } else if (pattern.type === "ObjectPattern") {
        for (const property of pattern.properties) {
          collectBindingIdentifiers(
            property.type === "RestElement" ? property.argument : property.value,
            identifiers,
          );
        }
      }
      return identifiers;
    }

    function descriptorValue(
      node,
      bindings = new Map(),
      resolving = new Set(),
      carrierBindings = new Map(),
    ) {
      const current = innerExpression(node);
      if (current.type === "CallExpression") {
        const invocation = createPortInvocation(current);
        if (invocation === undefined) return undefined;
        return {
          key: current,
          node: current,
          portType: typeParameters(current)[0],
          opaque: false,
        };
      }
      if (current.type === "MemberExpression") {
        const object = innerExpression(current.object);
        if (object.type === "Identifier") {
          const variable = resolvedVariable(sourceCode, object);
          if (variable !== undefined && importedVariable(variable)) {
            return {
              key: `import:${object.name}.${staticallyKnownMemberName(sourceCode, current) ?? "*"}`,
              node: current,
              portType: undefined,
              opaque: true,
            };
          }
        }
        const value = carrierMemberValue(current, resolving, carrierBindings);
        return value === undefined
          ? undefined
          : descriptorValue(value, bindings, resolving, carrierBindings);
      }
      if (current.type !== "Identifier") return undefined;
      const variable = resolvedVariable(sourceCode, current);
      if (variable === undefined) return undefined;
      const bound = bindings.get(variable);
      if (bound !== undefined) return bound;
      if (importedVariable(variable)) {
        return { key: variable, node: current, portType: undefined, opaque: true };
      }
      if (resolving.has(variable)) return undefined;
      const declaration = variableDeclarator(variable);
      if (declaration?.init === null || declaration?.init === undefined) return undefined;
      resolving.add(variable);
      const value = declaration.id.type === "Identifier"
        ? declaration.init
        : bindingExpression(
            declaration.id,
            current.name,
            declaration.init,
            resolving,
            carrierBindings,
          );
      const descriptor = value === undefined
        ? undefined
        : descriptorValue(value, bindings, resolving, carrierBindings);
      resolving.delete(variable);
      return descriptor;
    }

    function modelFunction(declarator) {
      if (declarator.init === null || declarator.init === undefined) return undefined;
      const initializer = innerExpression(declarator.init);
      if (isFunction(initializer)) return initializer;
      return initializer.type === "Identifier" ? variableFunction(sourceCode, initializer) : undefined;
    }

    function usedPortDescriptors(model) {
      const descriptors = new Map();
      const visiting = new Set();
      let opaqueCustomHook = false;
      const visitFunction = (fn, bindings = new Map(), carrierBindings = new Map()) => {
        if (visiting.has(fn)) return;
        visiting.add(fn);
        walk(sourceCode, fn.body, (node) => {
          if (node.type !== "CallExpression") return;
          const api = directBehavonCallName(sourceCode, node);
          if (api === "useExport" || api === "useSignal" || api === "useSlot") {
            const first = node.arguments[0];
            if (first === undefined || first.type === "SpreadElement") return;
            const current = innerExpression(first);
            const descriptor = descriptorValue(current, bindings, new Set(), carrierBindings);
            if (descriptor !== undefined) descriptors.set(descriptor.key, descriptor);
            return;
          }
          if (api !== undefined) return;
          const callee = innerExpression(node.callee);
          const hookName = callee.type === "Identifier"
            ? callee.name
            : callee.type === "MemberExpression" ? staticallyKnownMemberName(sourceCode, callee) : undefined;
          if (hookName === undefined || !customHookName.test(hookName)) return;
          const customHook = callee.type === "Identifier" ? variableFunction(sourceCode, callee) : undefined;
          if (customHook === undefined || customHook.body === null) {
            opaqueCustomHook = true;
            return;
          }
          const childBindings = new Map();
          const childCarrierBindings = new Map();
          for (let index = 0; index < customHook.params.length; index += 1) {
            const parameter = customHook.params[index];
            const argument = node.arguments[index];
            if (parameter === undefined || argument?.type === "SpreadElement") continue;
            const undefinedExpression = argument === undefined ? undefined : innerExpression(argument);
            const undefinedVariable = undefinedExpression?.type === "Identifier"
              ? resolvedVariable(sourceCode, undefinedExpression)
              : undefined;
            const explicitUndefined = undefinedExpression?.type === "Identifier" &&
              undefinedExpression.name === "undefined" &&
              (undefinedVariable === undefined || undefinedVariable.defs.length === 0);
            const source = argument === undefined || explicitUndefined ? undefined : argument;
            if (parameter.type === "RestElement" && parameter.argument.type === "Identifier") {
              const variable = resolvedVariable(sourceCode, parameter.argument);
              const elements = node.arguments.slice(index).map((candidate) =>
                candidate.type === "SpreadElement" ? null : candidate
              );
              if (variable !== undefined && !elements.includes(null)) {
                childCarrierBindings.set(variable, { type: "ArrayExpression", elements });
              }
              continue;
            }
            for (const identifier of collectBindingIdentifiers(parameter)) {
              const value = bindingExpression(
                parameter,
                identifier.name,
                source,
                new Set(),
                carrierBindings,
              );
              const variable = resolvedVariable(sourceCode, identifier);
              const descriptor = value === undefined
                ? undefined
                : descriptorValue(value, bindings, new Set(), carrierBindings);
              if (variable !== undefined && descriptor !== undefined) childBindings.set(variable, descriptor);
              else if (variable !== undefined && value !== undefined) childCarrierBindings.set(variable, value);
            }
          }
          visitFunction(customHook, childBindings, childCarrierBindings);
        }, false);
        visiting.delete(fn);
      };
      visitFunction(model);
      return { descriptors, opaqueCustomHook };
    }

    function modelAnnotationFromExpression(node, resolving = new Set()) {
      let current = node;
      while (current !== null && current !== undefined && transparentExpression(current)) {
        if (
          current.type === "TSAsExpression" ||
          current.type === "TSTypeAssertion" ||
          current.type === "TSSatisfiesExpression"
        ) {
          const annotation = directModelTypeReference(current.typeAnnotation);
          if (annotation !== undefined) return annotation;
        }
        current = current.expression;
      }
      if (current?.type === "Identifier") {
        const variable = resolvedVariable(sourceCode, current);
        if (variable === undefined || resolving.has(variable)) return undefined;
        const declaration = variableDeclarator(variable);
        if (declaration === undefined) return undefined;
        const annotation = modelType(declaration);
        if (annotation !== undefined) return annotation;
        if (declaration.init === null || declaration.init === undefined) return undefined;
        resolving.add(variable);
        const resolved = modelAnnotationFromExpression(declaration.init, resolving);
        resolving.delete(variable);
        return resolved;
      }
      if (current?.type === "MemberExpression") {
        const key = memberKey(current);
        const object = innerExpression(current.object);
        if (key !== undefined && object.type === "Identifier") {
          const variable = resolvedVariable(sourceCode, object);
          const declaration = variable === undefined ? undefined : variableDeclarator(variable);
          if (declaration?.id.type === "Identifier") {
            const contextual = objectMemberModelType(
              declaration.id.typeAnnotation?.typeAnnotation,
              key,
            );
            if (contextual !== undefined) return contextual;
            if (/^(0|[1-9]\d*)$/.test(key)) {
              const element = arrayElementModelType(
                declaration.id.typeAnnotation?.typeAnnotation,
                Number(key),
              );
              if (element !== undefined) return element;
            }
          }
        }
        const value = carrierMemberValue(current, resolving);
        return value === undefined ? undefined : modelAnnotationFromExpression(value, resolving);
      }
      return undefined;
    }

    const definitionContracts = new Map();

    function reportModelPortContract(reportNode, model, modelPortNode) {
      const { descriptors, opaqueCustomHook } = usedPortDescriptors(model);
      const concreteDescriptors = [...descriptors.values()].filter((descriptor) => !descriptor.opaque);
      if (concreteDescriptors.length > 1) {
        context.report({ node: reportNode, messageId: "mixedPortDescriptors" });
        return;
      }
      const descriptor = concreteDescriptors[0] ?? descriptors.values().next().value;
      const descriptorPortNode = descriptor?.portType;
      if (modelPortNode === undefined) {
        if (descriptor !== undefined) {
          context.report({
            node: reportNode,
            messageId: "missingModelPort",
            data: { port: typeText(descriptorPortNode) ?? "unknown" },
          });
        }
        return;
      }
      const modelPort = typeText(modelPortNode);
      if (descriptor === undefined) {
        if (opaqueCustomHook) return;
        context.report({
          node: reportNode,
          messageId: "missingPortDescriptor",
          data: { port: modelPort },
        });
        return;
      }
      const descriptorPort = typeText(descriptorPortNode);
      if (!descriptor.opaque && (descriptorPort === undefined || descriptorPort !== modelPort)) {
        context.report({
          node: reportNode,
          messageId: "mismatchedPortDescriptor",
          data: { modelPort, descriptorPort: descriptorPort ?? "unknown" },
        });
      }
    }

    function reportObjectExpressionModels(expression, typeNode) {
      const body = objectTypeBody(typeNode);
      const initializer = innerExpression(expression);
      if (body === undefined || initializer.type !== "ObjectExpression") return;
      for (const property of initializer.properties) {
        if (property.type !== "Property") continue;
        const key = staticPropertyKey(property.key, property.computed);
        if (key === undefined) continue;
        const annotation = objectMemberModelType(typeNode, key);
        if (annotation === undefined) continue;
        const resolved = resolveModelDefinition(property.value);
        const modelPortNode = typeParameters(annotation)[2];
        if (resolved.kind !== "function" || containingFunction(resolved.definition) !== undefined) continue;
        const port = typeText(modelPortNode);
        if (definitionContracts.has(resolved.definition) && definitionContracts.get(resolved.definition) === port) {
          continue;
        }
        reportModelPortContract(property.key, resolved.definition, modelPortNode);
        if (!definitionContracts.has(resolved.definition)) {
          definitionContracts.set(resolved.definition, port);
        }
      }
    }

    function reportContextualObjectModels(declarator) {
      if (
        declarator.id.type !== "Identifier" ||
        declarator.init === null ||
        declarator.init === undefined
      ) return;
      reportObjectExpressionModels(declarator.init, declarator.id.typeAnnotation?.typeAnnotation);
    }

    function reportArrayExpressionModels(expression, typeNode) {
      const initializer = innerExpression(expression);
      if (initializer.type !== "ArrayExpression") return;
      for (let index = 0; index < initializer.elements.length; index += 1) {
        const element = initializer.elements[index];
        if (element === null || element.type === "SpreadElement") continue;
        const annotation = arrayElementModelType(typeNode, index);
        if (annotation === undefined) continue;
        const resolved = resolveModelDefinition(element);
        const modelPortNode = typeParameters(annotation)[2];
        if (!isFunction(innerExpression(element))) continue;
        if (resolved.kind !== "function" || containingFunction(resolved.definition) !== undefined) continue;
        const port = typeText(modelPortNode);
        if (definitionContracts.has(resolved.definition) && definitionContracts.get(resolved.definition) === port) {
          continue;
        }
        reportModelPortContract(element, resolved.definition, modelPortNode);
        if (!definitionContracts.has(resolved.definition)) {
          definitionContracts.set(resolved.definition, port);
        }
      }
    }

    function reportContextualArrayModels(declarator) {
      if (
        declarator.id.type !== "Identifier" ||
        declarator.init === null ||
        declarator.init === undefined
      ) return;
      reportArrayExpressionModels(declarator.init, declarator.id.typeAnnotation?.typeAnnotation);
    }

    function reportPortContracts(program) {
      for (const statement of program.body) {
        if (statement.type === "TSTypeAliasDeclaration") {
          typeAliases.set(statement.id.name, statement.typeAnnotation);
        } else if (statement.type === "TSInterfaceDeclaration") {
          interfaces.set(statement.id.name, statement);
        }
      }
      for (const node of pendingSatisfiesExpressions) {
        const directModel = directModelTypeReference(node.typeAnnotation);
        const objectModelKeys = objectModelMemberKeys(node.typeAnnotation);
        const arrayModelIndices = arrayModelElementIndices(node.typeAnnotation, node.expression);
        if (
          directModel === undefined &&
          objectModelKeys.length === 0 &&
          arrayModelIndices.length === 0
        ) continue;
        let outer = node;
        while (outer.parent !== null && outer.parent !== undefined && transparentExpression(outer.parent)) {
          outer = outer.parent;
        }
        const declaration = outer.parent;
        const outerAnnotation = declaration?.type === "VariableDeclarator" &&
          declaration.init === outer &&
          declaration.id.type === "Identifier"
          ? declaration.id.typeAnnotation?.typeAnnotation
          : undefined;
        const preservingAnnotation = directModel !== undefined
          ? directModelTypeReference(outerAnnotation) !== undefined
          : objectModelKeys.length > 0
            ? objectModelKeys.every((key) => objectMemberModelType(outerAnnotation, key) !== undefined)
            : arrayModelIndices.every((index) => arrayElementModelType(outerAnnotation, index) !== undefined);
        if (!preservingAnnotation) context.report({ node, messageId: "nonPreservingModelType" });
      }
      walk(sourceCode, program, (node) => {
        if (
          node.type === "FunctionDeclaration" &&
          node.id !== null &&
          modelName.test(node.id.name) &&
          containingFunction(node) === undefined
        ) {
          definitionContracts.set(node, undefined);
          reportModelPortContract(node.id, node, undefined);
          return;
        }
        if (node.type !== "VariableDeclarator") return;
        reportContextualObjectModels(node);
        reportContextualArrayModels(node);
        const annotation = modelType(node);
        const model = modelFunction(node);
        if (model === undefined || containingFunction(model) !== undefined) return;
        if (annotation === undefined) {
          if (node.id.type === "Identifier" && modelName.test(node.id.name)) {
            definitionContracts.set(model, undefined);
            reportModelPortContract(node.id, model, undefined);
          }
          return;
        }
        const modelPortNode = typeParameters(annotation)[2];
        definitionContracts.set(model, typeText(modelPortNode));
        reportModelPortContract(node.id, model, modelPortNode);
      });

      walk(sourceCode, program, (node) => {
        if (node.type !== "TSSatisfiesExpression") return;
        if (objectModelMemberKeys(node.typeAnnotation).length > 0) {
          reportObjectExpressionModels(node.expression, node.typeAnnotation);
        }
        if (arrayModelElementIndices(node.typeAnnotation, node.expression).length > 0) {
          reportArrayExpressionModels(node.expression, node.typeAnnotation);
        }
        let outer = node;
        while (outer.parent !== null && outer.parent !== undefined && transparentExpression(outer.parent)) {
          outer = outer.parent;
        }
        const declaration = outer.parent;
        if (
          declaration?.type !== "VariableDeclarator" ||
          declaration.init !== outer ||
          declaration.id.type !== "Identifier" ||
          directModelTypeReference(declaration.id.typeAnnotation?.typeAnnotation) === undefined
        ) return;
        const annotation = directModelTypeReference(node.typeAnnotation);
        const resolved = resolveModelDefinition(node.expression);
        if (annotation === undefined) return;
        if (resolved.kind !== "function") return;
        reportModelPortContract(node, resolved.definition, typeParameters(annotation)[2]);
      });

      for (const statement of program.body) {
        if (statement.type !== "ExportDefaultDeclaration") continue;
        const annotation = modelAnnotationFromExpression(statement.declaration);
        const resolved = resolveModelDefinition(statement.declaration);
        if (resolved.kind !== "function" || containingFunction(resolved.definition) !== undefined) continue;
        if (annotation === undefined && definitionContracts.has(resolved.definition)) continue;
        const modelPortNode = annotation === undefined ? undefined : typeParameters(annotation)[2];
        definitionContracts.set(resolved.definition, typeText(modelPortNode));
        reportModelPortContract(statement.declaration, resolved.definition, modelPortNode);
      }

      for (const call of pendingCreateModelCalls) {
        const modelArgument = call.arguments[0];
        if (modelArgument === undefined || modelArgument.type === "SpreadElement") continue;
        const resolved = resolveModelDefinition(modelArgument);
        const explicitPort = typeParameters(call)[2];
        const annotation = modelAnnotationFromExpression(modelArgument);
        const modelPortNode = explicitPort ?? (
          annotation === undefined ? undefined : typeParameters(annotation)[2]
        );
        const directTypeOverride = explicitPort !== undefined || (
          transparentExpression(modelArgument) &&
          (
            modelArgument.type === "TSAsExpression" ||
            modelArgument.type === "TSTypeAssertion" ||
            modelArgument.type === "TSSatisfiesExpression"
          ) &&
          directModelTypeReference(modelArgument.typeAnnotation) !== undefined
        );
        if (resolved.kind !== "function" || containingFunction(resolved.definition) !== undefined) continue;
        if (
          directTypeOverride ||
          !definitionContracts.has(resolved.definition) ||
          definitionContracts.get(resolved.definition) !== typeText(modelPortNode)
        ) {
          reportModelPortContract(modelArgument, resolved.definition, modelPortNode);
        }
      }
    }

    function resolveModelDefinition(node, resolving = new Set()) {
      const current = innerExpression(node);
      if (isFunction(current)) return { kind: "function", definition: current };
      if (current.type === "Identifier") {
        const variable = resolvedVariable(sourceCode, current);
        if (variable === undefined || resolving.has(variable)) return { kind: "unknown" };
        const direct = variableFunction(sourceCode, current);
        if (direct !== undefined) return { kind: "function", definition: direct };
        const definition = variable.defs.find(
          (candidate) => candidate.type === "Variable" && candidate.node.type === "VariableDeclarator",
        );
        if (definition?.node.init === null || definition?.node.init === undefined) return { kind: "unknown" };
        resolving.add(variable);
        const result = resolveModelDefinition(definition.node.init, resolving);
        resolving.delete(variable);
        return result;
      }
      if (current.type === "MemberExpression") {
        const name = memberKey(current);
        const object = innerExpression(current.object);
        if (name === undefined || object.type !== "Identifier") return { kind: "unknown" };
        const variable = resolvedVariable(sourceCode, object);
        if (variable === undefined || resolving.has(variable)) return { kind: "unknown" };
        const definition = variable.defs.find(
          (candidate) => candidate.type === "Variable" && candidate.node.type === "VariableDeclarator",
        );
        const initializer = definition?.node.init === null || definition?.node.init === undefined
          ? undefined
          : innerExpression(definition.node.init);
        let value;
        if (initializer?.type === "ObjectExpression") {
          const property = initializer.properties.find((candidate) =>
            candidate.type === "Property" &&
            !candidate.computed &&
            (candidate.key.name ?? candidate.key.value) === name
          );
          if (property?.type !== "Property") return { kind: "unknown" };
          value = property.value;
        } else if (initializer?.type === "ArrayExpression" && /^(0|[1-9]\d*)$/.test(name)) {
          const element = initializer.elements[Number(name)];
          if (element === null || element === undefined || element.type === "SpreadElement") {
            return { kind: "unknown" };
          }
          value = element;
        } else {
          return { kind: "unknown" };
        }
        resolving.add(variable);
        const result = resolveModelDefinition(value, resolving);
        resolving.delete(variable);
        return result;
      }
      if (
        current.type === "CallExpression" ||
        current.type === "ConditionalExpression" ||
        current.type === "LogicalExpression" ||
        current.type === "SequenceExpression"
      ) return { kind: "dynamic" };
      return { kind: "unknown" };
    }

    return {
      "Program:exit": reportPortContracts,
      ExportNamedDeclaration(node) {
        if (node.source === null || !behavonModuleSource(node.source)) return;
        for (const specifier of node.specifiers) {
          const local = specifier.local?.name ?? specifier.local?.value;
          if (local === "createPort") {
            context.report({ node: specifier, messageId: "indirectPortDefinition" });
          }
        }
      },
      ImportExpression(node) {
        if (behavonModuleSource(node.source)) {
          context.report({ node, messageId: "indirectPortDefinition" });
        }
      },
      Identifier(node) {
        if (!namedCreatePortReference(node)) return;
        const variable = resolvedVariable(sourceCode, node);
        const reference = variable?.references.find((candidate) => candidate.identifier === node);
        if (reference === undefined || !reference.isRead()) return;
        if (!directCreatePortCallee(node)) {
          context.report({ node, messageId: "indirectPortDefinition" });
        }
        return;
      },
      "Identifier:exit"(node) {
        if (!namedCreateResourceReference(node)) return;
        const variable = resolvedVariable(sourceCode, node);
        const reference = variable?.references.find((candidate) => candidate.identifier === node);
        if (reference === undefined || !reference.isRead()) return;
        if (!directCreateResourceCallee(node)) context.report({ node, messageId: "indirectResourceDefinition" });
      },
      MemberExpression(node) {
        if (behavonCreatePortMember(node) && !directCreatePortCallee(node)) {
          context.report({ node, messageId: "indirectPortDefinition" });
        }
        if (behavonCreateResourceMember(node) && !directCreateResourceCallee(node)) {
          context.report({ node, messageId: "indirectResourceDefinition" });
        }
      },
      VariableDeclarator(node) {
        for (const property of destructuredCreatePortProperties(node)) {
          context.report({ node: property, messageId: "indirectPortDefinition" });
        }
        for (const property of destructuredCreateResourceProperties(node)) {
          context.report({ node: property, messageId: "indirectResourceDefinition" });
        }
      },
      TSSatisfiesExpression(node) {
        pendingSatisfiesExpressions.push(node);
      },
      CallExpression(node) {
        if (behavonRequireCall(node)) {
          context.report({ node, messageId: "indirectPortDefinition" });
          return;
        }
        const portInvocation = createPortInvocation(node);
        if (portInvocation !== undefined) {
          if (containingFunction(node) !== undefined) {
            context.report({ node, messageId: "dynamicPortDefinition" });
          }
          const declaration = node.arguments[0];
          const invalidDeclaration = declaration === undefined || declaration.type === "SpreadElement"
            ? declaration ?? node
            : invalidPortDeclarationMember(declaration);
          if (invalidDeclaration !== undefined) {
            context.report({
              node: invalidDeclaration,
              messageId: "nonInlinePortDeclaration",
            });
          } else {
            const reservedMember = reservedPortDeclarationMember(declaration);
            if (reservedMember !== undefined) {
              context.report({ node: reservedMember, messageId: "reservedPortMemberName" });
            }
          }
          return;
        }
        const resourceInvocation = createResourceFactory(node.callee);
        if (resourceInvocation !== undefined) {
          if (containingFunction(node) !== undefined) {
            context.report({ node, messageId: "dynamicResourceDefinition" });
          }
          return;
        }
        const api = directBehavonCallName(sourceCode, node);
        if (api !== "createModel") return;
        const modelArgument = node.arguments[0];
        const model = modelArgument === undefined ? undefined : innerExpression(modelArgument);
        if (model === undefined || model.type === "SpreadElement") return;

        if (isFunction(model)) {
          context.report({ node: model, messageId: "inlineModelDefinition", data: { api } });
          return;
        }

        const resolved = resolveModelDefinition(model);
        if (resolved.kind === "function" && containingFunction(resolved.definition) !== undefined) {
          context.report({ node: model, messageId: "dynamicModelDefinition", data: { api } });
          return;
        }
        if (resolved.kind === "dynamic") {
          context.report({ node: model, messageId: "dynamicModelFactory", data: { api } });
          return;
        }

        if (resolved.kind === "function") pendingCreateModelCalls.push(node);
      },
    };
  },
};

const evaluationPurityRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      nonLocalMutation: "Do not mutate a non-local value during Model or custom Hook evaluation.",
      immutableValue: "Do not mutate Model input, props, state, or a value returned by a Hook.",
      impureCall: "Do not call {{name}} during Model or custom Hook evaluation.",
      evaluationOperation: "Invoke Resource/Future operations, snapshot publication, and Signal/Slot dispatch from an Effect or managed callback after evaluation; invoke transaction lifecycle operations from a managed callback.",
      asyncTransactionRun: "Behavon.transaction.run requires a synchronous body; do not pass an async function.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function reportProgram(program) {
      const functions = [];
      const calls = [];
      walk(sourceCode, program, (node) => {
        if (isFunction(node)) functions.push(node);
        if (node.type === "CallExpression" || node.type === "NewExpression") calls.push(node);
      });

      const writesByVariable = new Map();
      const referenceWrites = [];
      const typeDefinitions = new Map();

      walk(sourceCode, program, (node) => {
        if (node.type === "TSInterfaceDeclaration") typeDefinitions.set(node.id.name, node.body);
        if (node.type === "TSTypeAliasDeclaration") typeDefinitions.set(node.id.name, node.typeAnnotation);
      });

      function patternBindingPaths(pattern, path = [], bindings = []) {
        const current = innerExpression(pattern);
        if (current.type === "Identifier") {
          const variable = resolvedVariable(sourceCode, current);
          if (variable !== undefined) bindings.push({ variable, path });
          return bindings;
        }
        if (current.type === "AssignmentPattern") {
          return patternBindingPaths(current.left, path, bindings);
        }
        if (current.type === "RestElement") return bindings;
        if (current.type === "ArrayPattern") {
          current.elements.forEach((element, index) => {
            if (element !== null) patternBindingPaths(element, [...path, String(index)], bindings);
          });
          return bindings;
        }
        if (current.type === "ObjectPattern") {
          for (const property of current.properties) {
            if (property.type === "RestElement") continue;
            const segment = !property.computed && property.key.type === "Identifier"
              ? property.key.name
              : (property.key.type === "Literal" || property.key.type === "StringLiteral" || property.key.type === "NumericLiteral")
                ? String(property.key.value)
                : undefined;
            if (segment !== undefined) patternBindingPaths(property.value, [...path, segment], bindings);
          }
        }
        return bindings;
      }

      function recordVariableWrites(pattern, value, node) {
        for (const binding of patternBindingPaths(pattern)) {
          const writes = writesByVariable.get(binding.variable) ?? [];
          writes.push({ node, value, path: binding.path });
          writesByVariable.set(binding.variable, writes);
        }
      }

      walk(sourceCode, program, (node) => {
        if (node.type === "VariableDeclarator" && node.init !== null) {
          recordVariableWrites(node.id, node.init, node);
          return;
        }
        if (node.type !== "AssignmentExpression" || node.operator !== "=") return;
        recordVariableWrites(node.left, node.right, node);
        const reference = referencePath(node.left);
        if (reference !== undefined && reference.segments.length > 0) {
          referenceWrites.push({ ...reference, node, value: node.right, owner: containingFunction(node) });
        }
      });

      const modelRoots = new Set();
      const exportedVariables = new Set();
      walk(sourceCode, program, (node) => {
        if (node.type === "ExportNamedDeclaration") {
          for (const specifier of node.specifiers) {
            if (specifier.local?.type !== "Identifier") continue;
            const variable = resolvedVariable(sourceCode, specifier.local);
            if (variable !== undefined) exportedVariables.add(variable);
          }
        } else if (node.type === "ExportDefaultDeclaration" && node.declaration.type === "Identifier") {
          const variable = resolvedVariable(sourceCode, node.declaration);
          if (variable !== undefined) exportedVariables.add(variable);
        }
      });

      function isExportedFunction(fn) {
        let current = fn;
        while (
          current.parent?.type === "VariableDeclarator" ||
          current.parent?.type === "VariableDeclaration"
        ) current = current.parent;
        if (current.parent?.type === "ExportNamedDeclaration" || current.parent?.type === "ExportDefaultDeclaration") {
          return true;
        }
        const identifier = fn.type === "FunctionDeclaration" || fn.type === "FunctionExpression"
          ? fn.id
          : fn.parent?.type === "VariableDeclarator" && fn.parent.id.type === "Identifier"
            ? fn.parent.id
            : undefined;
        return identifier !== undefined && exportedVariables.has(resolvedVariable(sourceCode, identifier));
      }

      for (const fn of functions) {
        const name = functionName(fn);
        if (
          name !== undefined &&
          customHookName.test(name) &&
          !publicHooks.has(name) &&
          isExportedFunction(fn)
        ) modelRoots.add(fn);
        walk(sourceCode, fn.body, (node) => {
          if (node.type !== "CallExpression") return;
          const name = directBehavonCallName(sourceCode, node);
          if (name !== undefined && publicHooks.has(name)) modelRoots.add(fn);
        }, false);
      }

      function referencedFunction(node, at = node, resolving = new Set()) {
        const current = innerExpression(node);
        if (isFunction(current)) return current;
        if (current.type === "Identifier") {
          const variable = resolvedVariable(sourceCode, current);
          if (variable === undefined || resolving.has(variable)) return undefined;
          const write = lastWrite(variable, at);
          if (write !== undefined) {
            const written = expressionAtPath(write.value, write.path ?? []);
            if (written === undefined) return undefined;
            resolving.add(variable);
            const result = referencedFunction(written, write.node, resolving);
            resolving.delete(variable);
            return result;
          }
          const direct = variableFunction(sourceCode, current);
          return direct;
        }
        if (current.type === "MemberExpression") {
          const reference = referencePath(current);
          if (reference === undefined) return undefined;
          const memberWrite = lastReferenceWrite(reference, at);
          const rootWrite = lastWrite(reference.variable, at);
          const write = memberWrite !== undefined && (rootWrite === undefined || memberWrite.node.range[0] > rootWrite.node.range[0])
            ? { ...memberWrite, path: reference.segments.slice(memberWrite.segments.length) }
            : rootWrite === undefined
              ? undefined
              : { ...rootWrite, path: [...(rootWrite.path ?? []), ...reference.segments] };
          if (write === undefined || resolving.has(reference.variable)) return undefined;
          const written = expressionAtPath(write.value, write.path ?? []);
          if (written === undefined) return undefined;
          resolving.add(reference.variable);
          const result = referencedFunction(written, write.node, resolving);
          resolving.delete(reference.variable);
          return result;
        }
        return undefined;
      }

      for (const call of calls) {
        if (call.type !== "CallExpression") continue;
        const name = directBehavonCallName(sourceCode, call);
        if (name !== "createModel") continue;
        const argument = call.arguments[0];
        if (argument === undefined || argument.type === "SpreadElement") continue;
        const fn = referencedFunction(argument, call);
        if (fn !== undefined) modelRoots.add(fn);
      }

      const evaluationFunctions = new Set(modelRoots);
      const managedCallbackByVariable = new Map();
      const operationVariables = new Set();
      const directlyImmutableVariables = new Set();
      const dependencyVariables = new Set();
      const hookShapeByVariable = new Map();
      const contextExternalVariables = new Set();
      const contextShapeByVariable = new Map();

      function addManagedCallback(variable, callback) {
        if (callback === undefined || callback.type === "SpreadElement") return false;
        const callbacks = managedCallbackByVariable.get(variable) ?? new Set();
        if (callbacks.has(callback)) return false;
        callbacks.add(callback);
        managedCallbackByVariable.set(variable, callbacks);
        return true;
      }

      function callbackResultShape(argument) {
        const fn = referencedFunction(argument);
        if (fn === undefined) return undefined;
        if (fn.type === "ArrowFunctionExpression" && fn.body.type !== "BlockStatement") {
          return freshShape(fn.body);
        }
        let shape;
        walk(sourceCode, fn.body, (node) => {
          if (node.type !== "ReturnStatement" || node.argument === null) return;
          const returned = freshShape(node.argument);
          shape = shape === undefined || shape === returned ? returned : "unknown";
        }, false);
        return shape;
      }

      function hookCallShape(call) {
        const hook = directBehavonCallName(sourceCode, call);
        if (hook === "useState" || hook === "useLabelState" || hook === "useReducer" || hook === "useSnapshot" || hook === "useModel") return "array";
        if (hook === "useMemo" && call.arguments[0]?.type !== "SpreadElement") {
          return callbackResultShape(call.arguments[0]);
        }
        return undefined;
      }

      function hookVariableShape(call, pattern, variable) {
        const hook = directBehavonCallName(sourceCode, call);
        if ((hook === "useState" || hook === "useLabelState") && pattern.type === "ArrayPattern") {
          const first = pattern.elements[0];
          if (first !== null && patternVariables(sourceCode, first).includes(variable)) {
            const initial = call.arguments[hook === "useLabelState" ? 1 : 0];
            if (initial !== undefined && initial.type !== "SpreadElement") {
              return freshShape(initial) ?? callbackResultShape(initial);
            }
          }
          return undefined;
        }
        if (hook === "useReducer" && pattern.type === "ArrayPattern") {
          const first = pattern.elements[0];
          if (first !== null && patternVariables(sourceCode, first).includes(variable)) {
            const initializer = call.arguments[2];
            if (initializer !== undefined && initializer.type !== "SpreadElement") {
              return callbackResultShape(initializer);
            }
            const initial = call.arguments[1];
            if (initial !== undefined && initial.type !== "SpreadElement") return freshShape(initial);
          }
          return undefined;
        }
        if (hook === "useMemo") return hookCallShape(call);
        return pattern.type === "Identifier" ? hookCallShape(call) : undefined;
      }

      function patternAnnotation(pattern) {
        const current = innerExpression(pattern);
        if (current.type === "AssignmentPattern") return current.left.typeAnnotation;
        return current.typeAnnotation;
      }

      for (const root of modelRoots) {
        for (const parameter of root.params) {
          const annotation = patternAnnotation(parameter);
          for (const binding of patternBindingPaths(parameter)) {
            directlyImmutableVariables.add(binding.variable);
            const shape = typeShape(typeNodeAtPath(annotation, binding.path));
            if (shape !== undefined) contextShapeByVariable.set(binding.variable, shape);
          }
        }
      }

      function registerHookResult(pattern, initializer) {
          const current = innerExpression(initializer);
          if (current.type !== "CallExpression") return;
          const hook = directBehavonCallName(sourceCode, current);
          const custom = current.callee.type === "Identifier" && customHookName.test(current.callee.name);
          if (hook === undefined && !custom) return;
          const variables = patternVariables(sourceCode, pattern);
          for (const variable of variables) {
            directlyImmutableVariables.add(variable);
            const shape = hookVariableShape(current, pattern, variable);
            if (shape !== undefined) hookShapeByVariable.set(variable, shape);
          }
          if (hook === "usePort") for (const variable of variables) dependencyVariables.add(variable);
          if (hook === "useSignal" || hook === "useSlot") {
            for (const variable of variables) operationVariables.add(variable);
          }
          if (hook === "useCallback") {
            for (const variable of variables) addManagedCallback(variable, current.arguments[0]);
          }
          if (hook === "useSnapshot" && pattern.type === "ArrayPattern" && pattern.elements[1] != null) {
            for (const variable of patternVariables(sourceCode, pattern.elements[1])) operationVariables.add(variable);
          }
      }

      function isHookResult(initializer) {
        const current = innerExpression(initializer);
        if (current.type !== "CallExpression") return false;
        const hook = directBehavonCallName(sourceCode, current);
        return hook !== undefined && publicHooks.has(hook) ||
          current.callee.type === "Identifier" && customHookName.test(current.callee.name);
      }

      for (const root of modelRoots) {
        walk(sourceCode, root.body, (node) => {
          if (node.type === "VariableDeclarator" && node.init !== null) {
            registerHookResult(node.id, node.init);
            return;
          }
          if (node.type !== "AssignmentExpression" || node.operator !== "=") return;
          registerHookResult(node.left, node.right);
        });
      }

      function lastWrite(variable, at) {
        return (writesByVariable.get(variable) ?? [])
          .filter((write) => write.node.range[0] < at.range[0])
          .sort((left, right) => right.node.range[0] - left.node.range[0])[0];
      }

      function freshShape(node) {
        const current = innerExpression(node);
        if (current.type === "ArrayExpression") return "array";
        if (current.type === "ObjectExpression") return "object";
        if (current.type === "NewExpression") {
          const path = memberPath(current.callee)?.join(".");
          const root = rootIdentifier(current.callee);
          const variable = root === undefined ? undefined : resolvedVariable(sourceCode, root);
          const globalBuiltin = variable === undefined || variable.defs.length === 0;
          if (globalBuiltin && (path === "Map" || path === "WeakMap")) return "map";
          if (globalBuiltin && (path === "Set" || path === "WeakSet")) return "set";
          if (globalBuiltin && path === "Array") return "array";
          return "object";
        }
        if (current.type === "CallExpression") {
          const path = memberPath(current.callee)?.join(".");
          const root = rootIdentifier(current.callee);
          const variable = root === undefined ? undefined : resolvedVariable(sourceCode, root);
          const globalBuiltin = variable === undefined || variable.defs.length === 0;
          if (globalBuiltin && (path === "Array" || path === "Array.from" || path === "Array.of")) return "array";
          if (globalBuiltin && path === "Object") return "object";
        }
        return undefined;
      }

      function referenceSegment(node) {
        if (!node.computed && node.property.type === "Identifier") return node.property.name;
        if (
          node.computed &&
          (node.property.type === "Literal" || node.property.type === "StringLiteral" || node.property.type === "NumericLiteral") &&
          (typeof node.property.value === "string" || typeof node.property.value === "number")
        ) return String(node.property.value);
        return undefined;
      }

      function referencePath(node) {
        const current = innerExpression(node);
        if (current.type === "Identifier") {
          const variable = resolvedVariable(sourceCode, current);
          return variable === undefined ? undefined : { variable, segments: [] };
        }
        if (current.type !== "MemberExpression") return undefined;
        const parent = referencePath(current.object);
        const segment = referenceSegment(current);
        return parent === undefined || segment === undefined
          ? undefined
          : { variable: parent.variable, segments: [...parent.segments, segment] };
      }

      function unwrapType(node) {
        let current = node?.type === "TSTypeAnnotation" ? node.typeAnnotation : node;
        while (
          current?.type === "TSParenthesizedType" ||
          current?.type === "TSOptionalType" ||
          current?.type === "TSRestType"
        ) current = current.typeAnnotation;
        return current;
      }

      function resolvedType(node, resolving = new Set()) {
        const current = unwrapType(node);
        if (
          current?.type === "TSTypeReference" &&
          current.typeName.type === "Identifier" &&
          typeDefinitions.has(current.typeName.name) &&
          !resolving.has(current.typeName.name)
        ) {
          resolving.add(current.typeName.name);
          const resolved = resolvedType(typeDefinitions.get(current.typeName.name), resolving);
          resolving.delete(current.typeName.name);
          return resolved;
        }
        return current;
      }

      function typeShape(node, resolving = new Set()) {
        const current = resolvedType(node, resolving);
        if (current === undefined) return undefined;
        if (current.type === "TSArrayType" || current.type === "TSTupleType") return "array";
        if (current.type === "TSTypeLiteral" || current.type === "TSInterfaceBody" || current.type === "TSMappedType") return "object";
        if (current.type === "TSTypeReference" && current.typeName.type === "Identifier") {
          if (current.typeName.name === "Array" || current.typeName.name === "ReadonlyArray") return "array";
          if (current.typeName.name === "Map" || current.typeName.name === "WeakMap") return "map";
          if (current.typeName.name === "Set" || current.typeName.name === "WeakSet") return "set";
        }
        if (current.type === "TSUnionType" || current.type === "TSIntersectionType") {
          const shapes = current.types.map((type) => typeShape(type, new Set(resolving)));
          return shapes.length > 0 && shapes.every((shape) => shape !== undefined && shape === shapes[0])
            ? shapes[0]
            : undefined;
        }
        return undefined;
      }

      function typeNodeAtPath(node, segments) {
        let current = node;
        for (const segment of segments) {
          current = resolvedType(current);
          if (current?.type === "TSArrayType") {
            if (!/^\d+$/.test(segment)) return undefined;
            current = current.elementType;
            continue;
          }
          if (current?.type === "TSTupleType") {
            const index = Number(segment);
            if (!Number.isInteger(index)) return undefined;
            current = current.elementTypes[index];
            continue;
          }
          const members = current?.type === "TSTypeLiteral"
            ? current.members
            : current?.type === "TSInterfaceBody"
              ? current.body
              : undefined;
          if (members === undefined) return undefined;
          const property = members.find((member) => {
            if (member.type !== "TSPropertySignature") return false;
            if (!member.computed && member.key.type === "Identifier") return member.key.name === segment;
            return (member.key.type === "Literal" || member.key.type === "StringLiteral" || member.key.type === "NumericLiteral") &&
              String(member.key.value) === segment;
          });
          current = property?.typeAnnotation;
        }
        return current;
      }

      function typeAtPath(variable, segments) {
        const annotation = variable?.identifiers.find((identifier) => identifier.typeAnnotation !== undefined)?.typeAnnotation;
        return typeShape(typeNodeAtPath(annotation, segments));
      }

      function expressionAtPath(expression, segments) {
        let current = innerExpression(expression);
        for (const segment of segments) {
          if (current.type === "ObjectExpression") {
            const property = current.properties.find((candidate) => {
              if (candidate.type !== "Property") return false;
              if (!candidate.computed && candidate.key.type === "Identifier") return candidate.key.name === segment;
              return (candidate.key.type === "Literal" || candidate.key.type === "StringLiteral" || candidate.key.type === "NumericLiteral") &&
                String(candidate.key.value) === segment;
            });
            if (property === undefined || property.type !== "Property") return undefined;
            current = innerExpression(property.value);
            continue;
          }
          if (current.type === "ArrayExpression" && /^\d+$/.test(segment)) {
            const element = current.elements[Number(segment)];
            if (element === null || element === undefined || element.type === "SpreadElement") return undefined;
            current = innerExpression(element);
            continue;
          }
          return undefined;
        }
        return current;
      }

      function shapeAtExpressionPath(expression, segments) {
        const current = expressionAtPath(expression, segments);
        return current === undefined ? undefined : freshShape(current);
      }

      function pathPrefix(prefix, value) {
        return prefix.length <= value.length && prefix.every((segment, index) => segment === value[index]);
      }

      function lastReferenceWrite(reference, at) {
        const owners = new Set();
        for (let parent = at.parent; parent !== null && parent !== undefined; parent = parent.parent) {
          if (isFunction(parent)) owners.add(parent);
        }
        owners.add(undefined);
        return referenceWrites
          .filter((write) =>
            write.variable === reference.variable &&
            owners.has(write.owner) &&
            pathPrefix(write.segments, reference.segments) &&
            write.node.range[0] < at.range[0])
          .sort((left, right) => right.node.range[0] - left.node.range[0])[0];
      }

      function valueInfo(expression, at, owner, resolving = new Set(), path = []) {
        const current = innerExpression(expression);
        if (path.length > 0) {
          const selected = expressionAtPath(current, path);
          if (selected !== undefined) return valueInfo(selected, at, owner, resolving);
          return expressionInfo(current, at, owner, resolving, path);
        }
        const shape = freshShape(current);
        if (shape !== undefined) return { kind: "local", shape };
        if (current.type === "CallExpression") {
          const path = memberPath(current.callee)?.join(".");
          if (path === "Array.from" || path === "Array.of") return { kind: "local", shape: "array" };
          if (path === "Object.freeze" && current.arguments[0]?.type !== "SpreadElement") {
            return valueInfo(current.arguments[0], at, owner, resolving);
          }
          return { kind: "local", shape: "unknown" };
        }
        return expressionInfo(current, at, owner, resolving);
      }

      function variableInfo(variable, at, owner, resolving = new Set()) {
        if (variable === undefined) return { kind: "external", shape: "unknown" };
        if (resolving.has(variable)) return { kind: "local", shape: "unknown" };
        if (!declaredInside(variable, owner)) {
          const definition = variable.defs.find((candidate) => candidate.type === "Variable");
          const initializer = definition?.node?.init;
          return {
            kind: "external",
            shape: initializer === null || initializer === undefined
              ? "unknown"
              : (freshShape(initializer) ?? "unknown"),
          };
        }
        const write = lastWrite(variable, at);
        if (write === undefined) {
          if (dependencyVariables.has(variable)) return { kind: "dependency", shape: "endpoint" };
          if (directlyImmutableVariables.has(variable)) {
            return { kind: "immutable", shape: contextShapeByVariable.get(variable) ?? "unknown" };
          }
          if (contextExternalVariables.has(variable)) {
            return { kind: "external", shape: contextShapeByVariable.get(variable) ?? "unknown" };
          }
          return { kind: "local", shape: "unknown" };
        }
        if (isHookResult(write.value)) {
          const hook = directBehavonCallName(sourceCode, innerExpression(write.value));
          return hook === "usePort"
            ? { kind: "dependency", shape: "endpoint" }
            : { kind: "immutable", shape: hookShapeByVariable.get(variable) ?? "unknown" };
        }
        resolving.add(variable);
        const result = valueInfo(write.value, at, owner, resolving, write.path ?? []);
        resolving.delete(variable);
        return result;
      }

      function expressionInfo(expression, at, owner, resolving = new Set(), extraSegments = []) {
        const reference = referencePath(expression);
        if (reference === undefined) {
          const selected = expressionAtPath(expression, extraSegments);
          return { kind: "local", shape: freshShape(selected ?? expression) ?? "unknown" };
        }
        reference.segments.push(...extraSegments);
        const base = variableInfo(reference.variable, at, owner, resolving);
        const memberWrite = lastReferenceWrite(reference, at);
        const rootWrite = lastWrite(reference.variable, at);
        if (memberWrite !== undefined && (rootWrite === undefined || memberWrite.node.range[0] > rootWrite.node.range[0])) {
          const remaining = reference.segments.slice(memberWrite.segments.length);
          if (isHookResult(memberWrite.value)) {
            const call = innerExpression(memberWrite.value);
            return { kind: "immutable", shape: remaining.length === 0 ? (hookCallShape(call) ?? "unknown") : "unknown" };
          }
          const info = valueInfo(memberWrite.value, at, owner, resolving, remaining);
          const shape = shapeAtExpressionPath(memberWrite.value, remaining);
          return shape === undefined ? info : { ...info, shape };
        }
        if (reference.segments.length > 0 && rootWrite !== undefined) {
          const info = valueInfo(
            rootWrite.value,
            at,
            owner,
            resolving,
            [...(rootWrite.path ?? []), ...reference.segments],
          );
          const shape = shapeAtExpressionPath(rootWrite.value, [
            ...(rootWrite.path ?? []),
            ...reference.segments,
          ]);
          if (info.kind !== "local" || shape !== undefined) {
            return shape === undefined ? info : { ...info, shape };
          }
        }
        const typedShape = typeAtPath(reference.variable, reference.segments);
        return typedShape === undefined ? base : { ...base, shape: typedShape };
      }

      function traceWrittenValue(expression, at, inspect, path = [], resolving = new Set()) {
        const current = innerExpression(expression);
        if (path.length > 0) {
          const selected = expressionAtPath(current, path);
          if (selected !== undefined) return traceWrittenValue(selected, at, inspect, [], resolving);
        }
        const inspected = inspect(current, path);
        if (inspected !== undefined) return inspected;
        const reference = referencePath(current);
        if (reference === undefined || resolving.has(reference.variable)) return undefined;
        reference.segments.push(...path);
        const memberWrite = lastReferenceWrite(reference, at);
        const rootWrite = lastWrite(reference.variable, at);
        let write;
        let remaining;
        if (memberWrite !== undefined && (rootWrite === undefined || memberWrite.node.range[0] > rootWrite.node.range[0])) {
          write = memberWrite;
          remaining = reference.segments.slice(memberWrite.segments.length);
        } else if (rootWrite !== undefined) {
          write = rootWrite;
          remaining = [...(rootWrite.path ?? []), ...reference.segments];
        } else {
          return undefined;
        }
        resolving.add(reference.variable);
        const result = traceWrittenValue(write.value, write.node, inspect, remaining, resolving);
        resolving.delete(reference.variable);
        return result;
      }

      function hookOperation(call, path) {
        const hook = directBehavonCallName(sourceCode, call);
        if ((hook === "useSignal" || hook === "useSlot") && path.length === 0) return true;
        if (hook === "useSnapshot" && path.length === 1 && path[0] === "1") return true;
        if (hook === "useFuture" && path.length >= 1 && (path[0] === "start" || path[0] === "abort")) return true;
        if (hook === "useResource" && path.length >= 2 && path[0] === "1") return true;
        return undefined;
      }

      function directTransactionOperation(expression) {
        const current = innerExpression(expression);
        if (current.type !== "MemberExpression" || current.computed || current.optional) return undefined;
        const method = memberName(current);
        if (!["start", "run", "commit", "rollback"].includes(method)) return undefined;
        const owner = innerExpression(current.object);
        if (owner.type === "Identifier") {
          const binding = importedBinding(sourceCode, owner);
          return binding?.kind === "named" && binding.imported === "transaction" ? method : undefined;
        }
        if (
          owner.type !== "MemberExpression" || owner.computed || owner.optional ||
          memberName(owner) !== "transaction"
        ) return undefined;
        const facade = innerExpression(owner.object);
        if (facade.type !== "Identifier") return undefined;
        return isBehavonFacadeBinding(importedBinding(sourceCode, facade)) ? method : undefined;
      }

      function dependencyProxyExpression(expression, at) {
        return traceWrittenValue(expression, at, (value, path) => {
          const current = innerExpression(value);
          if (
            current.type === "CallExpression" &&
            directBehavonCallName(sourceCode, current) === "usePort" &&
            path.length === 0
          ) return true;
          if (path.length !== 0 || current.type !== "Identifier") return undefined;
          const variable = resolvedVariable(sourceCode, current);
          return variable !== undefined &&
            lastWrite(variable, at) === undefined &&
            dependencyVariables.has(variable)
            ? true
            : undefined;
        }) === true;
      }

      function dependencyOperationExpression(expression, at) {
        return traceWrittenValue(expression, at, (value, path) => {
          const current = innerExpression(value);
          if (
            current.type === "CallExpression" &&
            directBehavonCallName(sourceCode, current) === "usePort" &&
            path.length === 1
          ) return true;
          return path.length === 0 &&
            current.type === "MemberExpression" &&
            dependencyProxyExpression(current.object, at)
            ? true
            : undefined;
        }) === true;
      }

      function operationExpression(expression, at) {
        if (directTransactionOperation(expression) !== undefined) return true;
        if (dependencyOperationExpression(expression, at)) return true;
        const traced = traceWrittenValue(expression, at, (current, path) => {
          if (current.type !== "CallExpression") return undefined;
          const direct = hookOperation(current, path);
          if (direct !== undefined) return direct;
          if (path.length !== 0) return undefined;
          const callee = innerExpression(current.callee);
          return callee.type === "MemberExpression" && memberName(callee) === "bind"
            ? operationExpression(callee.object, current)
            : undefined;
        });
        if (traced !== undefined) return traced;
        const current = innerExpression(expression);
        if (current.type === "SequenceExpression") {
          const invoked = current.expressions.at(-1);
          return invoked !== undefined && operationExpression(invoked, at);
        }
        if (current.type !== "Identifier") return false;
        const variable = resolvedVariable(sourceCode, current);
        return variable !== undefined && lastWrite(variable, at) === undefined && operationVariables.has(variable);
      }

      function reflectApplyTarget(call, callee) {
        if (callee.type !== "MemberExpression" || memberName(callee) !== "apply") return undefined;
        const owner = innerExpression(callee.object);
        if (owner.type !== "Identifier" || owner.name !== "Reflect") return undefined;
        const variable = resolvedVariable(sourceCode, owner);
        if (variable !== undefined && variable.defs.length > 0) return undefined;
        const target = call.arguments[0];
        return target === undefined || target.type === "SpreadElement" ? undefined : target;
      }

      function managedCallbackExpressions(expression, at) {
        const traced = traceWrittenValue(expression, at, (current, path) => {
          if (current.type !== "CallExpression" || path.length !== 0) return undefined;
          const hook = directBehavonCallName(sourceCode, current);
          return hook === "useCallback" && current.arguments[0]?.type !== "SpreadElement"
            ? current.arguments[0]
            : undefined;
        });
        if (traced !== undefined) return [traced];
        const current = innerExpression(expression);
        if (current.type !== "Identifier") return [];
        const variable = resolvedVariable(sourceCode, current);
        return variable !== undefined && lastWrite(variable, at) === undefined
          ? [...(managedCallbackByVariable.get(variable) ?? [])]
          : [];
      }

      function directImpureName(expression) {
        const current = innerExpression(expression);
        if (current.type !== "MemberExpression") return undefined;
        const path = memberPath(current);
        const root = rootIdentifier(current);
        const variable = root === undefined ? undefined : resolvedVariable(sourceCode, root);
        if (variable !== undefined && variable.defs.length > 0) return undefined;
        const name = path?.join(".");
        return name === "Date.now" || name === "Math.random" || name === "performance.now" || name === "crypto.randomUUID"
          ? name
          : undefined;
      }

      function impureFunctionExpression(expression, at) {
        return traceWrittenValue(expression, at, (current, path) =>
          path.length === 0 ? directImpureName(current) : undefined);
      }

      // Hook factories and lazy initializers execute during evaluation. A managed
      // callback remains deferred unless the Model invokes that callback immediately.
      const modelContextFunctions = new Set(modelRoots);
      for (const fn of functions) {
        for (let parent = fn.parent; parent !== null && parent !== undefined; parent = parent.parent) {
          if (isFunction(parent) && modelRoots.has(parent)) {
            modelContextFunctions.add(fn);
            break;
          }
        }
      }

      function callTarget(call) {
        const callee = innerExpression(call.callee);
        if (callee.type === "MemberExpression") {
          const method = memberName(callee);
          return method === "call" || method === "apply"
            ? referencedFunction(callee.object, call)
            : referencedFunction(callee, call);
        }
        return referencedFunction(callee, call);
      }

      function callArguments(call) {
        const callee = innerExpression(call.callee);
        if (callee.type !== "MemberExpression") return call.arguments;
        const method = memberName(callee);
        if (method === "call") return call.arguments.slice(1);
        if (method === "apply") {
          const array = call.arguments[1];
          return array?.type === "ArrayExpression" ? array.elements : [];
        }
        return call.arguments;
      }

      function addContextShape(variable, shape) {
        if (shape === undefined || shape === "unknown") return false;
        const previous = contextShapeByVariable.get(variable);
        if (previous === shape) return false;
        if (previous === "unknown") return false;
        if (previous !== undefined && previous !== shape) {
          contextShapeByVariable.set(variable, "unknown");
          return true;
        }
        contextShapeByVariable.set(variable, shape);
        return true;
      }

      function propagateCallContext(call, callee, callerOwner, callerIsEvaluation) {
        let propagated = false;
        const args = callArguments(call);
        for (let index = 0; index < callee.params.length; index += 1) {
          const argument = args[index];
          if (argument === undefined || argument === null || argument.type === "SpreadElement") continue;
          const info = expressionInfo(argument, call, callerOwner);
          const operation = operationExpression(argument, call);
          const callbacks = managedCallbackExpressions(argument, call);
          for (const variable of patternVariables(sourceCode, callee.params[index])) {
            if (info.kind === "immutable" && !directlyImmutableVariables.has(variable)) {
              directlyImmutableVariables.add(variable);
              propagated = true;
            }
            if (info.kind === "dependency" && !dependencyVariables.has(variable)) {
              dependencyVariables.add(variable);
              propagated = true;
            }
            if (callerIsEvaluation && info.kind === "external" && !contextExternalVariables.has(variable)) {
              contextExternalVariables.add(variable);
              propagated = true;
            }
            if (operation && !operationVariables.has(variable)) {
              operationVariables.add(variable);
              propagated = true;
            }
            for (const callback of callbacks) {
              if (addManagedCallback(variable, callback)) propagated = true;
            }
            if (addContextShape(variable, info.shape)) propagated = true;
          }
        }
        return propagated;
      }

      let changed = true;
      while (changed) {
        changed = false;
        for (const call of calls) {
          if (call.type !== "CallExpression") continue;
          const parentFunction = containingFunction(call);
          if (parentFunction === undefined) continue;
          const parentIsEvaluation = evaluationFunctions.has(parentFunction);
          const parentIsModelContext = modelContextFunctions.has(parentFunction);
          const name = directBehavonCallName(sourceCode, call);
          if (parentIsModelContext && name !== undefined && publicHooks.has(name)) {
            for (const argument of call.arguments) {
              if (argument === undefined || argument.type === "SpreadElement") continue;
              const fn = referencedFunction(argument);
              if (fn !== undefined && !modelContextFunctions.has(fn)) {
                modelContextFunctions.add(fn);
                changed = true;
              }
            }
          }

          const helper = callTarget(call);
          if (parentIsModelContext && helper !== undefined) {
            if (!modelContextFunctions.has(helper)) {
              modelContextFunctions.add(helper);
              changed = true;
            }
            const callerOwner = modelOwner(call) ?? parentFunction;
            if (propagateCallContext(call, helper, callerOwner, parentIsEvaluation)) changed = true;
          }

          if (!parentIsEvaluation) continue;
          const synchronousIndexes = name === "useMemo" || name === "useState"
            ? [0]
            : name === "useLabelState" ? [1]
            : name === "useReducer" ? [0, 2]
            : name === "useSyncExternalStore" ? [1] : [];
          for (const index of synchronousIndexes) {
            const argument = call.arguments[index];
            if (argument !== undefined && argument.type !== "SpreadElement") {
              const fn = referencedFunction(argument);
              if (fn !== undefined && !evaluationFunctions.has(fn)) {
                evaluationFunctions.add(fn);
                changed = true;
              }
            }
          }
          const callee = innerExpression(call.callee);
          if (isFunction(callee) && !evaluationFunctions.has(callee)) {
            evaluationFunctions.add(callee);
            changed = true;
          }
          if (callee.type === "Identifier") {
            for (const callback of managedCallbackExpressions(callee, call)) {
              const fn = referencedFunction(callback);
              if (fn !== undefined && !evaluationFunctions.has(fn)) {
                evaluationFunctions.add(fn);
                changed = true;
              }
            }
            if (helper !== undefined && !evaluationFunctions.has(helper)) {
              evaluationFunctions.add(helper);
              changed = true;
            }
          } else if (callee.type === "MemberExpression") {
            const method = memberName(callee);
            const callbackTarget = method === "call" || method === "apply" ? callee.object : callee;
            for (const callback of managedCallbackExpressions(callbackTarget, call)) {
              const fn = referencedFunction(callback);
              if (fn !== undefined && !evaluationFunctions.has(fn)) {
                evaluationFunctions.add(fn);
                changed = true;
              }
            }
            if (helper !== undefined && !evaluationFunctions.has(helper)) {
              evaluationFunctions.add(helper);
              changed = true;
            }
          }
        }
      }

      function modelOwner(node) {
        for (let current = node.parent; current !== null && current !== undefined; current = current.parent) {
          if (isFunction(current) && modelRoots.has(current)) return current;
        }
        return undefined;
      }

      function provenanceOwner(node) {
        const root = modelOwner(node);
        if (root !== undefined) return root;
        const fn = containingFunction(node);
        return fn !== undefined && modelContextFunctions.has(fn) ? fn : undefined;
      }

      function evaluationOwner(node) {
        const fn = containingFunction(node);
        return fn !== undefined && evaluationFunctions.has(fn) ? fn : undefined;
      }

      function classifyMutation(target, node, bindingWrite = false) {
        const owner = provenanceOwner(node) ?? evaluationOwner(node);
        if (owner === undefined) return;
        const identifier = rootIdentifier(target);
        if (identifier === undefined) return;
        const variable = resolvedVariable(sourceCode, identifier);
        const currentTarget = innerExpression(target);
        const directTarget = bindingWrite && currentTarget.type === "Identifier";
        const inspectedTarget = bindingWrite && currentTarget.type === "MemberExpression"
          ? currentTarget.object
          : target;
        const info = expressionInfo(inspectedTarget, node, owner);
        if (info.kind === "immutable" && !directTarget) {
          context.report({ node, messageId: "immutableValue" });
          return;
        }
        if (evaluationOwner(node) === undefined) return;
        if (!directTarget && info.kind === "external") {
          context.report({ node, messageId: "nonLocalMutation" });
        } else if (directTarget && (variable === undefined || !declaredInside(variable, owner))) {
          context.report({ node, messageId: "nonLocalMutation" });
        }
      }

      function classifyMutationTarget(target, node) {
        const current = innerExpression(target);
        if (current.type === "ArrayPattern") {
          for (const element of current.elements) if (element !== null) classifyMutationTarget(element, node);
          return;
        }
        if (current.type === "ObjectPattern") {
          for (const property of current.properties) {
            classifyMutationTarget(property.type === "RestElement" ? property.argument : property.value, node);
          }
          return;
        }
        if (current.type === "AssignmentPattern") {
          classifyMutationTarget(current.left, node);
          return;
        }
        if (current.type === "RestElement") {
          classifyMutationTarget(current.argument, node);
          return;
        }
        classifyMutation(current, node, true);
      }

      function classifyHookAssignmentTarget(target, node) {
        const current = innerExpression(target);
        if (current.type === "ArrayPattern") {
          for (const element of current.elements) if (element !== null) classifyHookAssignmentTarget(element, node);
          return;
        }
        if (current.type === "ObjectPattern") {
          for (const property of current.properties) {
            classifyHookAssignmentTarget(property.type === "RestElement" ? property.argument : property.value, node);
          }
          return;
        }
        if (current.type === "AssignmentPattern" || current.type === "RestElement") {
          classifyHookAssignmentTarget(
            current.type === "AssignmentPattern" ? current.left : current.argument,
            node,
          );
          return;
        }
        const owner = provenanceOwner(node) ?? evaluationOwner(node);
        const identifier = rootIdentifier(current);
        const variable = identifier === undefined ? undefined : resolvedVariable(sourceCode, identifier);
        if (
          owner !== undefined &&
          evaluationOwner(node) !== undefined &&
          (variable === undefined || !declaredInside(variable, owner))
        ) context.report({ node, messageId: "nonLocalMutation" });
      }

      walk(sourceCode, program, (node) => {
        if (node.type === "AssignmentExpression") {
          if (isHookResult(node.right)) classifyHookAssignmentTarget(node.left, node);
          else classifyMutationTarget(node.left, node);
          return;
        }
        if (node.type === "UpdateExpression") {
          classifyMutation(node.argument, node, true);
          return;
        }
        if (node.type === "UnaryExpression" && node.operator === "delete") {
          classifyMutationTarget(node.argument, node);
          return;
        }
        if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
          if (node.left.type !== "VariableDeclaration") classifyMutationTarget(node.left, node);
          return;
        }
        if (node.type === "NewExpression") {
          if (evaluationOwner(node) === undefined) return;
          const path = memberPath(node.callee);
          const variable = resolvedVariable(sourceCode, rootIdentifier(node.callee));
          if (
            path?.length === 1 &&
            (path[0] === "Date" || path[0] === "WebSocket") &&
            (variable === undefined || variable.defs.length === 0)
          ) {
            context.report({ node, messageId: "impureCall", data: { name: `new ${path[0]}` } });
          }
          return;
        }
        if (node.type !== "CallExpression") return;

        const callee = innerExpression(node.callee);
        const invocationMethod = callee.type === "MemberExpression" ? memberName(callee) : undefined;
        const reflectedTarget = reflectApplyTarget(node, callee);
        const invocationTarget = reflectedTarget ?? (
          callee.type === "MemberExpression" &&
          (invocationMethod === "call" || invocationMethod === "apply")
            ? callee.object
            : callee
        );
        const transactionOperation = directTransactionOperation(invocationTarget);
        if (transactionOperation === "run") {
          const body = node.arguments[1];
          const directBody = body === undefined || body.type === "SpreadElement"
            ? undefined
            : innerExpression(body);
          if (isFunction(directBody) && directBody.async) {
            context.report({ node: body, messageId: "asyncTransactionRun" });
          }
        }
        if (evaluationOwner(node) !== undefined) {
          if (invocationMethod !== "bind" && operationExpression(invocationTarget, node)) {
            context.report({ node, messageId: "evaluationOperation" });
          }
          const impureName = impureFunctionExpression(invocationTarget, node);
          if (impureName !== undefined) {
            context.report({ node, messageId: "impureCall", data: { name: impureName } });
          }
        }

        if (callee.type === "MemberExpression") {
          const method = memberName(callee);
          if (method !== undefined && collectionMutatingMethods.has(method)) {
            const owner = provenanceOwner(node) ?? evaluationOwner(node);
            const info = owner === undefined
              ? { kind: "local", shape: "unknown" }
              : expressionInfo(callee.object, node, owner);
            const compatible = info.shape === "array"
              ? mutatingMethods.has(method)
              : info.shape === "map"
                ? method === "set" || method === "delete" || method === "clear"
                : info.shape === "set"
                  ? method === "add" || method === "delete" || method === "clear"
                  : false;
            if (info.kind !== "dependency" && compatible) classifyMutation(callee.object, node);
          }
          const path = memberPath(callee);
          const global = path === undefined ? undefined : resolvedVariable(sourceCode, rootIdentifier(callee));
          const globalBuiltin = global === undefined || global.defs.length === 0;
          const impure = path?.join(".");
          if (
            globalBuiltin &&
            impure === "Object.assign" &&
            node.arguments[0] !== undefined &&
            node.arguments[0].type !== "SpreadElement"
          ) classifyMutation(node.arguments[0], node);
          if (
            globalBuiltin &&
            impure === "Reflect.set" &&
            node.arguments[0] !== undefined &&
            node.arguments[0].type !== "SpreadElement"
          ) classifyMutation(node.arguments[0], node);
        }
      });
    }

    return { "Program:exit": reportProgram };
  },
};

const dependencyHooks = new Set(["useEffect", "useMemo", "useCallback"]);

function dependencyMemberPath(node) {
  const current = innerExpression(node);
  if (current.type === "Identifier") return [current.name];
  if (
    (current.type !== "MemberExpression" && current.type !== "OptionalMemberExpression") ||
    current.computed
  ) return undefined;
  const object = dependencyMemberPath(current.object);
  const property = memberName(current);
  return object === undefined || property === undefined ? undefined : [...object, property];
}

function dependencyReferenceExpression(identifier) {
  let current = identifier;
  for (;;) {
    const parent = current.parent;
    if (
      (parent?.type === "MemberExpression" || parent?.type === "OptionalMemberExpression") &&
      parent.object === current &&
      !parent.computed &&
      memberName(parent) !== undefined &&
      !(
        (parent.parent?.type === "CallExpression" || parent.parent?.type === "OptionalCallExpression") &&
        parent.parent.callee === parent
      )
    ) {
      current = parent;
      continue;
    }
    return current;
  }
}

function variableDefinedWithin(variable, node) {
  return variable.defs.some((definition) => {
    const definitionNode = definition.name ?? definition.node;
    return definitionNode?.range !== undefined &&
      definitionNode.range[0] >= node.range[0] &&
      definitionNode.range[1] <= node.range[1];
  });
}

function variableDefinedOutside(variable, node) {
  return variable.defs.length === 0 || variable.defs.every((definition) => {
    const definitionNode = definition.name ?? definition.node;
    return definitionNode?.range === undefined ||
      definitionNode.range[0] < node.range[0] ||
      definitionNode.range[1] > node.range[1];
  });
}

function variableDeclarator(variable) {
  if (variable.defs.length !== 1) return undefined;
  const definition = variable.defs[0];
  return definition.type === "Variable" && definition.node.type === "VariableDeclarator"
    ? definition.node
    : undefined;
}

function directStableBehavonHookValue(sourceCode, variable) {
  const declaration = variableDeclarator(variable);
  if (declaration === undefined || declaration.init === null) return false;
  if (variable.references.some((reference) => reference.isWrite() && reference.init !== true)) {
    return false;
  }
  const initializer = innerExpression(declaration.init);
  if (initializer.type !== "CallExpression") return false;
  const hook = canonicalPublicHookCallName(sourceCode, initializer);
  if (hook === "useSignal" || hook === "useSlot") {
    return declaration.id.type === "Identifier" && variable.identifiers.includes(declaration.id);
  }
  if (hook === "useMutable") {
    return declaration.id.type === "Identifier" && variable.identifiers.includes(declaration.id);
  }
  if (hook === "useExport") {
    return declaration.id.type === "Identifier" && variable.identifiers.includes(declaration.id);
  }
  if (hook === "useFuture") {
    return declaration.id.type === "Identifier" && variable.identifiers.includes(declaration.id);
  }
  if (hook !== "useState" && hook !== "useLabelState" && hook !== "useReducer" && hook !== "useModel" && hook !== "useSnapshot" && hook !== "useResource") return false;
  if (declaration.id.type !== "ArrayPattern") return false;
  const stableElement = declaration.id.elements[1];
  return stableElement?.type === "Identifier" && variable.identifiers.includes(stableElement);
}

function constantPrimitive(variable) {
  const declaration = variableDeclarator(variable);
  if (declaration === undefined || declaration.init === null) return false;
  const parent = declaration.parent;
  if (parent?.type !== "VariableDeclaration" || parent.kind !== "const") return false;
  const initializer = innerExpression(declaration.init);
  return (initializer.type === "Literal" || initializer.type === "StringLiteral" || initializer.type === "NumericLiteral") &&
    (initializer.value === null || ["string", "number", "boolean"].includes(typeof initializer.value));
}

function isUnshadowedUndefined(sourceCode, node) {
  if (node.type !== "Identifier" || node.name !== "undefined") return false;
  const variable = resolvedVariable(sourceCode, node);
  return variable === undefined || variable.defs.length === 0;
}

const exhaustiveDependenciesRule = {
  meta: {
    type: "problem",
    schema: [],
    hasSuggestions: true,
    messages: {
      missingDependencies: "Behavon.{{hook}} has missing dependencies: {{dependencies}}. Include them or remove the dependency array.",
      unnecessaryDependencies: "Behavon.{{hook}} has unnecessary dependencies: {{dependencies}}. Exclude them from the dependency array.",
      duplicateDependencies: "Behavon.{{hook}} has duplicate dependencies: {{dependencies}}. Omit the duplicates.",
      outerScopeDependencies: "Behavon.{{hook}} has outer-scope dependencies: {{dependencies}}. Outer-scope values are not valid dependencies because changing them does not reevaluate the Model.",
      dynamicDependencies: "Behavon.{{hook}} received a dependency list that is not an array literal, so its dependencies cannot be statically verified.",
      missingDependencyArray: "Behavon.{{hook}} requires an explicit dependency array so its dependencies can be statically verified.",
      complexDependency: "Behavon.{{hook}} has a complex dependency expression. Extract it to a local variable so it can be statically verified.",
      unknownDependencies: "Behavon.{{hook}} received a callback whose dependencies are unknown. Pass an inline callback or a same-file local function.",
      staleAssignment: "Assignments to '{{dependency}}' from inside Behavon.{{hook}} are lost after each Model evaluation. Move the value inside the callback or store it in Model state.",
      updateDependencies: "Update the dependencies array to: [{{dependencies}}].",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function functionWithoutReactiveCaptures(variable, owner, resolving = new Set()) {
      if (resolving.has(variable)) return true;
      const identifier = variable.identifiers[0];
      if (identifier === undefined) return false;
      const fn = variableFunction(sourceCode, identifier);
      if (fn === undefined) return false;
      resolving.add(variable);
      let stable = true;
      walk(sourceCode, fn.body, (node) => {
        if (!stable || node.type !== "Identifier") return;
        const captured = resolvedVariable(sourceCode, node);
        if (captured === undefined) return;
        const reference = captured.references.find((candidate) => candidate.identifier === node);
        if (reference === undefined) return;
        if (variableDefinedWithin(captured, fn) || variableDefinedOutside(captured, owner)) return;
        if (reference.isWrite()) {
          stable = false;
          return;
        }
        if (!reference.isRead()) return;
        if (constantPrimitive(captured) || directStableBehavonHookValue(sourceCode, captured)) return;
        if (functionWithoutReactiveCaptures(captured, owner, resolving)) return;
        stable = false;
      });
      resolving.delete(variable);
      return stable;
    }

    function callbackFunction(argument) {
      const current = innerExpression(argument);
      if (isFunction(current)) return current;
      if (current.type !== "Identifier") return undefined;
      return variableFunction(sourceCode, current);
    }

    function collectCallbackDependencies(callback, owner) {
      const dependencies = new Map();
      const staleAssignments = new Map();
      walk(sourceCode, callback.body, (node) => {
        if (node.type !== "Identifier") return;
        const variable = resolvedVariable(sourceCode, node);
        if (variable === undefined) return;
        const reference = variable.references.find((candidate) => candidate.identifier === node);
        if (reference === undefined) return;
        if (variableDefinedWithin(variable, callback)) return;
        if (variableDefinedOutside(variable, owner)) return;
        if (reference.isWrite() && !staleAssignments.has(node.name)) {
          staleAssignments.set(node.name, reference.writeExpr ?? node);
        }
        if (!reference.isRead()) return;
        const expression = dependencyReferenceExpression(node);
        const path = dependencyMemberPath(expression);
        if (path === undefined) return;
        const key = path.join(".");
        if (!dependencies.has(key)) {
          dependencies.set(key, {
            expression,
            stable: constantPrimitive(variable) ||
              directStableBehavonHookValue(sourceCode, variable) ||
              functionWithoutReactiveCaptures(variable, owner),
          });
        }
      });
      return { dependencies, staleAssignments };
    }

    function dependencyRootVariable(node) {
      const path = dependencyMemberPath(node);
      if (path === undefined) return undefined;
      let current = innerExpression(node);
      while (current.type === "MemberExpression" || current.type === "OptionalMemberExpression") {
        current = innerExpression(current.object);
      }
      return current.type === "Identifier" ? resolvedVariable(sourceCode, current) : undefined;
    }

    function formatList(values) {
      return [...values].sort().map((value) => `'${value}'`).join(", ");
    }

    function dependencySatisfied(used, declared) {
      return used === declared || used.startsWith(`${declared}.`);
    }

    function reportCompleteness(call, hook) {
      const owner = containingFunction(call);
      if (owner === undefined) return;
      const callbackArgument = call.arguments[0];
      if (callbackArgument === undefined || callbackArgument.type === "SpreadElement") return;
      const dependencyArgument = call.arguments[1];
      if (hook === "useEffect" && (
        dependencyArgument === undefined ||
        isUnshadowedUndefined(sourceCode, dependencyArgument)
      )) return;
      if (dependencyArgument === undefined) {
        context.report({ node: call.callee, messageId: "missingDependencyArray", data: { hook } });
        return;
      }
      if (dependencyArgument.type === "SpreadElement") {
        context.report({ node: dependencyArgument, messageId: "dynamicDependencies", data: { hook } });
        return;
      }
      const dependencyNode = innerExpression(dependencyArgument);
      const dependencyElements = dependencyNode.type === "ArrayExpression" ? dependencyNode.elements : [];
      if (dependencyNode.type !== "ArrayExpression") {
        context.report({ node: dependencyArgument, messageId: "dynamicDependencies", data: { hook } });
      }

      const callback = callbackFunction(callbackArgument);
      if (callback === undefined) {
        const callbackExpression = innerExpression(callbackArgument);
        const callbackPath = callbackExpression.type === "Identifier"
          ? dependencyMemberPath(callbackExpression)
          : undefined;
        const callbackVariable = callbackExpression.type === "Identifier"
          ? resolvedVariable(sourceCode, callbackExpression)
          : undefined;
        if (callbackVariable !== undefined && variableDefinedOutside(callbackVariable, owner)) return;
        const callbackIncluded = callbackPath !== undefined && dependencyElements.some((element) =>
          element !== null && element.type !== "SpreadElement" &&
          dependencyMemberPath(element)?.join(".") === callbackPath.join(".")
        );
        if (!callbackIncluded) {
          context.report({ node: call.callee, messageId: "unknownDependencies", data: { hook } });
        }
        return;
      }

      const { dependencies: used, staleAssignments } = collectCallbackDependencies(callback, owner);
      if (staleAssignments.size > 0) {
        for (const [dependency, node] of staleAssignments) {
          context.report({ node, messageId: "staleAssignment", data: { hook, dependency } });
        }
        return;
      }
      const declared = [];
      const duplicate = new Set();
      const outer = new Set();
      let hasComplexDependency = false;
      for (const element of dependencyElements) {
        if (element === null || element.type === "SpreadElement") {
          hasComplexDependency = true;
          context.report({ node: element ?? dependencyNode, messageId: "complexDependency", data: { hook } });
          continue;
        }
        const path = dependencyMemberPath(element);
        if (path === undefined) {
          hasComplexDependency = true;
          context.report({ node: element, messageId: "complexDependency", data: { hook } });
          continue;
        }
        const key = path.join(".");
        if (declared.includes(key)) duplicate.add(key);
        declared.push(key);
        const variable = dependencyRootVariable(element);
        if (variable === undefined || variableDefinedOutside(variable, owner)) outer.add(key);
      }

      const missingCandidates = [...used].filter(([, value]) =>
        !value.stable
      ).map(([key]) => key).filter((key) =>
        !declared.some((declaredKey) => dependencySatisfied(key, declaredKey))
      );
      const missing = new Set(missingCandidates.filter((key) =>
        !missingCandidates.some((candidate) => candidate !== key && dependencySatisfied(key, candidate))
      ));
      const unnecessary = new Set();
      if (hook !== "useEffect") {
        for (const declaredKey of declared) {
          if (outer.has(declaredKey)) continue;
          if (![...used.keys()].some((usedKey) => dependencySatisfied(usedKey, declaredKey))) {
            unnecessary.add(declaredKey);
          }
        }
      }

      const suggested = [];
      for (const key of declared) {
        if (duplicate.has(key) || outer.has(key) || unnecessary.has(key) || suggested.includes(key)) continue;
        suggested.push(key);
      }
      for (const key of missing) {
        if (!suggested.some((declaredKey) => dependencySatisfied(key, declaredKey))) suggested.push(key);
      }
      const suggestion = {
        messageId: "updateDependencies",
        data: { dependencies: suggested.join(", ") },
        fix(fixer) {
          return fixer.replaceText(dependencyArgument, `[${suggested.join(", ")}]`);
        },
      };
      const canSuggest = dependencyNode.type === "ArrayExpression" && !hasComplexDependency;
      const categories = [
        [missing, "missingDependencies"],
        [outer, "outerScopeDependencies"],
        [unnecessary, "unnecessaryDependencies"],
        [duplicate, "duplicateDependencies"],
      ];
      for (const [values, messageId] of categories) {
        if (values.size === 0) continue;
        context.report({
          node: dependencyArgument,
          messageId,
          data: { hook, dependencies: formatList(values) },
          ...(canSuggest ? { suggest: [suggestion] } : {}),
        });
      }
    }

    return {
      CallExpression(node) {
        const hook = canonicalPublicHookCallName(sourceCode, node);
        if (hook !== undefined && dependencyHooks.has(hook)) reportCompleteness(node, hook);
      },
    };
  },
};

export const behavonHooksPlugin = {
  rules: {
    "canonical-api": canonicalApiRule,
    "evaluation-purity": evaluationPurityRule,
    "exhaustive-deps": exhaustiveDependenciesRule,
    "static-model-definition": staticModelDefinitionRule,
  },
};
