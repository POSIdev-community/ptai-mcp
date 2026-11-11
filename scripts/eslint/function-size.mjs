export function classifyFunctionSize(lines) {
  if (lines <= 20) {
    return 'optimal';
  }
  if (lines <= 35) {
    return 'normal';
  }
  if (lines <= 50) {
    return 'acceptable';
  }
  return 'oversized';
}

export function codeLineCount(source, node) {
  const occupied = new Set();
  for (const token of source.getTokens(node)) {
    for (let line = token.loc.start.line; line <= token.loc.end.line; line++) {
      if (source.lines[line - 1].trim()) {
        occupied.add(line);
      }
    }
  }
  return occupied.size;
}

export default {
  meta: {
    type: 'suggestion',
    schema: [{ type: 'object', properties: { reportAll: { type: 'boolean' } }, additionalProperties: false }],
    messages: {
      optimal: 'Optimal: {{lines}} code lines (up to 20).',
      normal: 'Normal: {{lines}} code lines (21–35).',
      acceptable: 'Review: {{lines}} code lines (36–50); consider extracting a named step.',
      oversized: 'Oversized: {{lines}} code lines; the maximum is 50.',
    },
  },
  create(context) {
    function inspect(node) {
      const lines = codeLineCount(context.sourceCode, node);
      const band = classifyFunctionSize(lines);
      if (context.options[0]?.reportAll || band === 'acceptable') {
        context.report({ node, messageId: band, data: { lines } });
      }
    }
    return { FunctionDeclaration: inspect, FunctionExpression: inspect, ArrowFunctionExpression: inspect };
  },
};
