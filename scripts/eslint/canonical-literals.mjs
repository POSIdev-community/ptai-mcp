import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cache = new Map();
const normalized = (file) => path.resolve(file).replaceAll('\\', '/').toLowerCase();

function constantModules(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'vendor' ? [] : constantModules(file);
    }
    return /(?:constants|models|error-codes|scan-status|tool-names|effects)\.(?:ts|js)$/.test(entry.name) ? [file] : [];
  });
}

function definitions(file) {
  const modified = fs.statSync(file).mtimeMs;
  const previous = cache.get(file);
  if (previous?.modified === modified) {
    return previous.entries;
  }
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const entries = [];
  function add(value, declaration, member = '') {
    entries.push({ value, file: normalized(file), declaration, member });
  }
  for (const statement of tree.statements) {
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      readVariableDefinitions(declaration, tree, add);
    }
  }
  cache.set(file, { modified, entries });
  return entries;
}

function readVariableDefinitions(declaration, tree, add) {
  const name = declaration.name.getText(tree);
  let initializer = declaration.initializer;

  while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer))) {
    initializer = initializer.expression;
  }

  if (initializer && ts.isStringLiteral(initializer)) {
    add(initializer.text, name);
  }

  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    return;
  }

  for (const property of initializer.properties) {
    if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)) {
      add(property.initializer.text, name, property.name.getText(tree));
    }
  }
}

export function canonicalLiterals() {
  const registry = new Map();
  for (const file of constantModules(path.join(root, 'src'))) {
    for (const entry of definitions(file)) {
      const entries = registry.get(entry.value) ?? [];
      entries.push(entry);
      registry.set(entry.value, entries);
    }
  }
  return registry;
}

export function isCanonicalDefinition(node, filename, definitions) {
  const member = node.parent.type === 'Property' ? (node.parent.key.name ?? node.parent.key.value) : '';
  let parent = node.parent;
  while (parent && !['VariableDeclarator', 'FunctionExpression', 'ArrowFunctionExpression'].includes(parent.type)) {
    parent = parent.parent;
  }
  if (parent?.type !== 'VariableDeclarator') {
    return false;
  }
  return definitions.some(
    (entry) => entry.file === normalized(filename) && entry.declaration === parent.id.name && entry.member === member,
  );
}
