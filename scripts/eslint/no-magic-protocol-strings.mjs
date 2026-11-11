import ts from 'typescript';
import { canonicalLiterals, isCanonicalDefinition } from './canonical-literals.mjs';
import { fieldName, isLiteralCandidate, isProtocolIdentifier, isStandardApiArgument } from './literal-context.mjs';

const protocolFields = new Set(['state', 'effects', 'action', 'section', 'kind', 'correlation', 'stage']);
function isProtocolValue(node) {
  if (isProtocolIdentifier(node.value)) {
    return true;
  }
  const parent = node.parent;
  if (parent.type === 'Property' && parent.value === node) {
    return protocolFields.has(fieldName(parent.key));
  }
  if (parent.type !== 'BinaryExpression' || !['===', '!==', '==', '!='].includes(parent.operator)) {
    return false;
  }
  const other = parent.left === node ? parent.right : parent.left;
  return other.type === 'MemberExpression' && protocolFields.has(fieldName(other.property));
}

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Keep protocol identifiers and state values in their owning constants module.' },
    schema: [],
    messages: {
      constant: 'Use a named protocol constant instead of the string literal {{value}}.',
    },
  },
  create(context) {
    const registry = canonicalLiterals();
    const services = context.sourceCode.parserServices;
    const checker = services.program?.getTypeChecker();
    function hasLiteralContract(node) {
      if (isStandardApiArgument(node)) {
        return false;
      }
      if (!checker || !services.esTreeNodeToTSNodeMap) {
        return false;
      }
      const mapped = services.esTreeNodeToTSNodeMap.get(node);
      const parent = node.parent;
      let compared;
      if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(parent.operator)) {
        compared = parent.left === node ? parent.right : parent.left;
      }
      const type =
        checker.getContextualType(mapped) ??
        (compared ? checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(compared)) : undefined);
      if (!type) {
        return false;
      }
      const members = type.isUnion() ? type.types : [type];
      return members.some((member) => Boolean(member.flags & ts.TypeFlags.StringLiteral));
    }
    return {
      Literal(node) {
        if (!isLiteralCandidate(node)) {
          return;
        }
        const definitions = registry.get(node.value) ?? [];
        if (isCanonicalDefinition(node, context.filename, definitions)) {
          return;
        }
        // Matching bytes alone do not establish a shared domain meaning.
        if (isProtocolValue(node) || hasLiteralContract(node)) {
          context.report({ node, messageId: 'constant', data: { value: JSON.stringify(node.value) } });
        }
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? node.value.raw;
        for (const value of registry.keys()) {
          if (isProtocolIdentifier(value) && text.includes(value)) {
            context.report({ node, messageId: 'constant', data: { value: JSON.stringify(value) } });
          }
        }
      },
    };
  },
};
