const collections = new Set(['Map', 'Set', 'WeakMap', 'WeakSet']);

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      exposed: 'Keep module-level mutable collections private; export operations, snapshots or factories instead.',
    },
  },
  create(context) {
    return {
      Program(program) {
        const initializers = new Map();
        const exports = [];
        for (const statement of program.body) {
          if (statement.type === 'ExportNamedDeclaration' && statement.exportKind === 'type') {
            continue;
          }
          const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
          if (declaration?.type === 'VariableDeclaration') {
            collectVariables(declaration, statement.type === 'ExportNamedDeclaration', initializers, exports);
          }
          if (statement.type === 'ExportNamedDeclaration' && !statement.source) {
            collectRuntimeSpecifiers(statement, exports);
          }
          if (statement.type === 'ExportDefaultDeclaration') {
            exports.push({ node: statement, value: statement.declaration });
          }
        }
        for (const exported of exports) {
          if (isCollection(exported.value, initializers, context.sourceCode)) {
            context.report({ node: exported.node, messageId: 'exposed' });
          }
        }
      },
    };
  },
};

function collectVariables(declaration, exported, initializers, exports) {
  for (const variable of declaration.declarations) {
    if (variable.id.type !== 'Identifier') {
      continue;
    }
    initializers.set(variable.id.name, variable.init);
    if (exported) {
      exports.push({ node: variable, value: variable.init });
    }
  }
}

function collectRuntimeSpecifiers(statement, exports) {
  for (const specifier of statement.specifiers) {
    if (specifier.exportKind !== 'type') {
      exports.push({ node: specifier, value: specifier.local });
    }
  }
}

function isCollection(value, initializers, source, seen = new Set()) {
  if (!value) {
    return false;
  }
  if (['TSAsExpression', 'TSTypeAssertion', 'TSSatisfiesExpression', 'TSNonNullExpression'].includes(value.type)) {
    return isCollection(value.expression, initializers, source, seen);
  }
  if (value.type === 'Identifier' && !seen.has(value.name)) {
    seen.add(value.name);
    return isCollection(initializers.get(value.name), initializers, source, seen);
  }
  if (value.type === 'NewExpression') {
    return value.callee.type === 'Identifier' && collections.has(value.callee.name) && isGlobal(value.callee, source);
  }
  if (value.type === 'CallExpression' && value.callee.type === 'MemberExpression') {
    const { object, property } = value.callee;
    if (
      object.type === 'Identifier' &&
      object.name === 'Object' &&
      isGlobal(object, source) &&
      property.type === 'Identifier' &&
      ['freeze', 'seal', 'preventExtensions'].includes(property.name)
    ) {
      return isCollection(value.arguments[0], initializers, source, seen);
    }
  }
  return false;
}

function isGlobal(identifier, source) {
  for (let scope = source.getScope(identifier); scope; scope = scope.upper) {
    const binding = scope.set.get(identifier.name);
    if (binding) {
      return binding.defs.length === 0;
    }
  }
  return true;
}
