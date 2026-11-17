import { canonicalLiterals, isCanonicalDefinition } from './canonical-literals.mjs';
import { isLiteralCandidate, isProtocolIdentifier, isStandardApiArgument } from './literal-context.mjs';

export default {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      review:
        'Literal {{value}} occurs {{count}} times; review its meanings before deciding whether to share a constant.',
    },
  },
  create(context) {
    const occurrences = new Map();
    const definitions = canonicalLiterals();
    return {
      Literal(node) {
        if (
          !isLiteralCandidate(node) ||
          isStandardApiArgument(node) ||
          isProtocolIdentifier(node.value) ||
          node.value.length < 3
        ) {
          return;
        }
        if (isCanonicalDefinition(node, context.filename, definitions.get(node.value) ?? [])) {
          return;
        }
        const nodes = occurrences.get(node.value) ?? [];
        nodes.push(node);
        occurrences.set(node.value, nodes);
      },
      'Program:exit'() {
        for (const [value, nodes] of occurrences) {
          if (nodes.length >= 3) {
            context.report({
              node: nodes[0],
              messageId: 'review',
              data: { value: JSON.stringify(value), count: nodes.length },
            });
          }
        }
      },
    };
  },
};
