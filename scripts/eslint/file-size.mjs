import { codeLineCount } from './function-size.mjs';

export function classifyFileSize(lines) {
  if (lines <= 150) {
    return 'optimal';
  }
  if (lines <= 300) {
    return 'normal';
  }
  if (lines <= 500) {
    return 'review';
  }
  return 'oversized';
}

function exceptionReason(source) {
  const header = source.getAllComments().filter((comment) => comment.loc.start.line <= 5);
  const declaration = header.find((comment) => comment.value.trim().startsWith('file-size-exception:'));
  return declaration?.value.trim().slice('file-size-exception:'.length).trim();
}

const messages = {
  optimal: 'Optimal: {{lines}} code lines, {{physical}} physical lines (up to 150 code lines).',
  normal: 'Normal: {{lines}} code lines, {{physical}} physical lines (151–300 code lines).',
  review: 'Review: {{lines}} code lines, {{physical}} physical lines (301–500); inspect module responsibilities.',
  oversized: 'Oversized: {{lines}} code lines; split the file or document a file-size-exception in its header.',
  exception: 'Explicit file-size exception: {{lines}} code lines. Reason: {{reason}}',
  reason: 'A file-size-exception must explain the architectural reason in at least 30 characters.',
};

export default {
  meta: {
    type: 'suggestion',
    schema: [{ type: 'object', properties: { reportAll: { type: 'boolean' } }, additionalProperties: false }],
    messages,
  },
  create(context) {
    return {
      Program(node) {
        const source = context.sourceCode;
        const lines = codeLineCount(source, node);
        const physical = source.text.trimEnd().split(/\r?\n/).length;
        const reason = exceptionReason(source);
        const band = classifyFileSize(lines);
        if (context.options[0]?.reportAll || band === 'review' || (band === 'oversized' && reason?.length >= 30)) {
          context.report({
            node,
            messageId: band === 'oversized' && reason?.length >= 30 ? 'exception' : band,
            data: { lines, physical, reason },
          });
        }
      },
    };
  },
};

export const fileSizeLimit = {
  meta: { type: 'suggestion', schema: [], messages },
  create(context) {
    return {
      Program(node) {
        const reason = exceptionReason(context.sourceCode);
        if (reason !== undefined && reason.length < 30) {
          context.report({ node, messageId: 'reason' });
        } else if (codeLineCount(context.sourceCode, node) > 500 && !reason) {
          context.report({ node, messageId: 'oversized', data: { lines: codeLineCount(context.sourceCode, node) } });
        }
      },
    };
  },
};
