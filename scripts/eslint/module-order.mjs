// Values keep their dependency order; this rule deliberately has no sorting autofix.
function declarationGroup(statement) {
  const exported = statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration';
  const node = exported ? statement.declaration : statement;

  if (!node) {
    return undefined;
  }

  switch (node.type) {
    case 'TSInterfaceDeclaration':
    case 'TSTypeAliasDeclaration':
      return exported ? 0 : 3;
    case 'VariableDeclaration':
    case 'TSEnumDeclaration':
      return 0;
    case 'ClassDeclaration':
      // Private base classes must be initialized before public subclasses or values.
      return exported ? 1 : 0;
    case 'FunctionDeclaration':
    case 'TSDeclareFunction':
      return exported ? 1 : 2;
    default:
      return undefined;
  }
}

export default {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      order:
        'Keep module declarations in order: public types and initialization, public API, private functions, local types. Preserve initialization dependencies when moving code.',
    },
  },
  create(context) {
    return {
      Program(program) {
        let latestGroup = 0;

        for (const statement of program.body) {
          const group = declarationGroup(statement);

          if (group === undefined) {
            continue;
          }

          if (group < latestGroup) {
            context.report({ node: statement, messageId: 'order' });
          }

          latestGroup = Math.max(latestGroup, group);
        }
      },
    };
  },
};
