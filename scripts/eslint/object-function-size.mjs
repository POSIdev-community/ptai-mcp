import { codeLineCount } from './function-size.mjs';

export default {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      size: 'Object with inline functions has {{lines}} code lines; the maximum is 50. Extract named functions and keep the registry compact.',
    },
  },
  create(context) {
    return {
      ObjectExpression(node) {
        const hasInlineFunction = node.properties.some(
          (property) => property.type === 'Property' && isInlineFunction(property.value),
        );
        if (!hasInlineFunction) {
          return;
        }
        const lines = codeLineCount(context.sourceCode, node);
        if (lines > 50) {
          context.report({ node, messageId: 'size', data: { lines } });
        }
      },
    };
  },
};

function isInlineFunction(value) {
  while (['TSAsExpression', 'TSTypeAssertion', 'TSSatisfiesExpression', 'TSNonNullExpression'].includes(value.type)) {
    value = value.expression;
  }
  return value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression';
}
