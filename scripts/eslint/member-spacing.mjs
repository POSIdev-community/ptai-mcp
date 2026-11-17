export default {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: {
      blank: 'Separate class methods and field groups with a blank line.',
      opening: 'Start a nonempty class body with a blank line.',
    },
  },
  create(context) {
    return {
      ClassBody(node) {
        if (!node.body.length) {
          return;
        }
        const openingGap = context.sourceCode.text.slice(node.range[0] + 1, node.body[0].range[0]);
        if (!/^\r?\n[\t ]*\r?\n/.test(openingGap)) {
          context.report({
            node: node.body[0],
            messageId: 'opening',
            fix: (fixer) => fixer.insertTextAfterRange([node.range[0], node.range[0] + 1], '\n'),
          });
        }
        for (let index = 1; index < node.body.length; index++) {
          const previous = node.body[index - 1];
          const current = node.body[index];
          const methodBoundary = previous.type.includes('Method') || current.type.includes('Method');
          const fieldGroupChanged =
            (previous.accessibility ?? 'public') !== (current.accessibility ?? 'public') ||
            Boolean(previous.static) !== Boolean(current.static);
          if (!methodBoundary && !fieldGroupChanged) {
            continue;
          }
          const gap = context.sourceCode.text.slice(previous.range[1], current.range[0]);
          if (!/\n\s*\n/.test(gap)) {
            context.report({
              node: current,
              messageId: 'blank',
              fix: (fixer) => fixer.insertTextAfter(previous, '\n'),
            });
          }
        }
      },
    };
  },
};
