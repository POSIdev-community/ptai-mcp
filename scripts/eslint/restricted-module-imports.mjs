import path from 'node:path';

export default {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'array',
        items: {
          type: 'object',
          properties: { path: { type: 'string' }, reason: { type: 'string' } },
          required: ['path', 'reason'],
          additionalProperties: false,
        },
      },
    ],
    messages: { boundary: '{{reason}}' },
  },
  create(context) {
    const restricted = (context.options[0] ?? []).map((entry) => ({
      ...entry,
      module: moduleId(path.resolve(context.cwd, entry.path)),
    }));
    function inspect(source) {
      const value =
        source?.type === 'TemplateLiteral' && source.expressions.length === 0
          ? source.quasis[0].value.cooked
          : source?.value;
      if (typeof value !== 'string' || (!value.startsWith('.') && !path.isAbsolute(value))) {
        return;
      }
      const imported = moduleId(path.resolve(path.dirname(context.filename), value));
      const entry = restricted.find((candidate) => candidate.module === imported);
      if (entry) {
        context.report({ node: source, messageId: 'boundary', data: { reason: entry.reason } });
      }
    }
    return {
      ImportDeclaration: (node) => inspect(node.source),
      ExportNamedDeclaration: (node) => inspect(node.source),
      ExportAllDeclaration: (node) => inspect(node.source),
      ImportExpression: (node) => inspect(node.source),
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          isGlobal(node.callee, context.sourceCode)
        ) {
          inspect(node.arguments[0]);
        }
      },
    };
  },
};

function moduleId(file) {
  const normalized = path.normalize(file).replace(/\.[cm]?[jt]s$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
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
