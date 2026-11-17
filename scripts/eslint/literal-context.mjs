const technicalWords = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'function',
  'undefined',
  'array',
  'integer',
  'null',
]);
const standardApiMethods = new Set([
  'toString',
  'readFile',
  'readFileSync',
  'writeFile',
  'writeFileSync',
  'setEncoding',
  'on',
  'once',
  'addEventListener',
  'removeEventListener',
  'normalize',
  'digest',
  'from',
  'update',
  'off',
]);

export function fieldName(node) {
  return node?.type === 'Identifier' ? node.name : node?.value;
}

function isSchemaPropertyReference(node) {
  const array = node.parent;
  const property = array.parent;
  if (array.type !== 'ArrayExpression' || property?.type !== 'Property' || fieldName(property.key) !== 'required') {
    return false;
  }
  const schema = property.parent;
  return (
    schema.type === 'ObjectExpression' &&
    schema.properties.some((entry) => entry.type === 'Property' && fieldName(entry.key) === 'properties')
  );
}

export function isLiteralCandidate(node) {
  if (typeof node.value !== 'string' || !node.value || technicalWords.has(node.value)) {
    return false;
  }
  const parent = node.parent;
  if (parent.type === 'TSLiteralType' || parent.type.startsWith('Import') || parent.type.startsWith('Export')) {
    return false;
  }
  return !(parent.type === 'Property' && parent.key === node && !parent.computed) && !isSchemaPropertyReference(node);
}

export function isStandardApiArgument(node) {
  const call = node.parent.type === 'CallExpression' ? node.parent : undefined;
  const method = call?.callee.type === 'MemberExpression' ? call.callee.property : call?.callee;
  return standardApiMethods.has(fieldName(method));
}

export function isProtocolIdentifier(value) {
  return /^(?:AIE|LOCAL)_[A-Z_]+$|^aie_[a-z_]+$|^ptai\.mcp\.|^AI\.[A-Z_.]+$/.test(value);
}
