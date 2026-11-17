import { codeLineCount } from './function-size.mjs';

export default {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: { size: 'Constructor has {{lines}} code lines; limit construction to 40 and extract named operations.' },
  },
  create(context) {
    return {
      'MethodDefinition[kind="constructor"]'(node) {
        const lines = codeLineCount(context.sourceCode, node.value);
        if (lines > 40) {
          context.report({ node, messageId: 'size', data: { lines } });
        }
      },
    };
  },
};
