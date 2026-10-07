interface ObjectEntry {
  key: string;
  keyStart: number;
  valueStart: number;
  valueEnd: number;
  commaAfter: number | null;
}

interface ObjectShape {
  start: number;
  end: number;
  entries: ObjectEntry[];
}

/** Parse JSONC without changing offsets, including comments and trailing commas. */
export function parseJsonc(source: string): Record<string, unknown> {
  const sanitized = sanitizeJsonc(source);
  return JSON.parse(removeTrailingCommas(sanitized)) as Record<string, unknown>;
}

/**
 * Set or remove a two-level object property while preserving comments and
 * formatting outside the affected property.
 */
export function updateJsoncProperty(
  source: string,
  parentKey: string,
  propertyKey: string,
  value: Record<string, unknown> | undefined,
): string {
  return updateJsoncPropertyPath(source, [parentKey, propertyKey], value);
}

/**
 * Set or remove a nested object property while preserving comments and
 * formatting outside the affected property.
 */
export function updateJsoncPropertyPath(
  source: string,
  propertyPath: string[],
  value: Record<string, unknown> | undefined,
): string {
  if (propertyPath.length === 0) throw new Error('OpenCode configuration property path cannot be empty.');
  const initial = source.trim() === '' ? '{}\n' : source;
  const sanitized = sanitizeJsonc(initial);
  const rootStart = sanitized.indexOf('{');
  if (rootStart < 0) throw new Error('OpenCode configuration must contain a JSON object.');
  const root = readObject(sanitized, rootStart);
  return updateObjectProperty(initial, sanitized, root, propertyPath, value);
}

function updateObjectProperty(
  source: string,
  sanitized: string,
  object: ObjectShape,
  propertyPath: string[],
  value: Record<string, unknown> | undefined,
): string {
  const [propertyKey, ...remainingPath] = propertyPath;
  const property = object.entries.find((entry) => entry.key === propertyKey);

  if (remainingPath.length === 0) {
    if (property) {
      if (value !== undefined) {
        return replaceRange(
          source,
          property.valueStart,
          property.valueEnd,
          formatValue(value, indentationAt(source, property.keyStart)),
        );
      }
      return removeObjectEntry(source, object, property);
    }
    return value === undefined ? source : insertObjectProperty(source, object, propertyKey, value);
  }

  if (!property) {
    if (value === undefined) return source;
    return insertObjectProperty(source, object, propertyKey, nestedValue(remainingPath, value));
  }

  if (sanitized[property.valueStart] !== '{') {
    if (value === undefined) return source;
    const replacement = formatValue(nestedValue(remainingPath, value), indentationAt(source, property.keyStart));
    return replaceRange(source, property.valueStart, property.valueEnd, replacement);
  }

  return updateObjectProperty(source, sanitized, readObject(sanitized, property.valueStart), remainingPath, value);
}

function nestedValue(propertyPath: string[], value: Record<string, unknown>): Record<string, unknown> {
  return propertyPath.reduceRight<Record<string, unknown>>((nested, propertyKey) => ({ [propertyKey]: nested }), value);
}

function sanitizeJsonc(source: string): string {
  const chars = [...source];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (current === '\\') escaped = true;
      else if (current === '"') inString = false;
      continue;
    }
    if (current === '"') {
      inString = true;
      continue;
    }
    if (current === '/' && chars[i + 1] === '/') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 2;
      while (i < chars.length && chars[i] !== '\n' && chars[i] !== '\r') {
        chars[i] = ' ';
        i += 1;
      }
      i -= 1;
      continue;
    }
    if (current === '/' && chars[i + 1] === '*') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 2;
      while (i < chars.length && !(chars[i] === '*' && chars[i + 1] === '/')) {
        if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
        i += 1;
      }
      if (i < chars.length) {
        chars[i] = ' ';
        chars[i + 1] = ' ';
        i += 1;
      }
    }
  }
  return chars.join('');
}

function removeTrailingCommas(source: string): string {
  const chars = [...source];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < chars.length; i += 1) {
    if (inString) {
      if (escaped) escaped = false;
      else if (chars[i] === '\\') escaped = true;
      else if (chars[i] === '"') inString = false;
      continue;
    }
    if (chars[i] === '"') {
      inString = true;
      continue;
    }
    if (chars[i] !== ',') continue;
    let next = i + 1;
    while (/\s/.test(chars[next] ?? '')) next += 1;
    if (chars[next] === '}' || chars[next] === ']') chars[i] = ' ';
  }
  return chars.join('');
}

function readObject(source: string, start: number): ObjectShape {
  if (source[start] !== '{') throw new Error('Expected a JSON object.');
  const entries: ObjectEntry[] = [];
  let cursor = start + 1;

  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === '}') return { start, end: cursor, entries };
    if (source[cursor] !== '"') throw new Error('Invalid JSON object property.');

    const keyStart = cursor;
    const keyEnd = readStringEnd(source, cursor);
    const key = JSON.parse(source.slice(keyStart, keyEnd)) as string;
    cursor = skipWhitespace(source, keyEnd);
    if (source[cursor] !== ':') throw new Error('Invalid JSON object property separator.');
    cursor = skipWhitespace(source, cursor + 1);
    const valueStart = cursor;
    const valueEnd = readValueEnd(source, cursor);
    cursor = skipWhitespace(source, valueEnd);
    const commaAfter = source[cursor] === ',' ? cursor : null;
    entries.push({ key, keyStart, valueStart, valueEnd, commaAfter });
    if (commaAfter !== null) cursor += 1;
    else if (source[cursor] !== '}') throw new Error('Invalid JSON object delimiter.');
  }

  throw new Error('Unterminated JSON object.');
}

function readValueEnd(source: string, start: number): number {
  const first = source[start];
  if (first === '"') return readStringEnd(source, start);
  if (first === '{' || first === '[') {
    const open = first;
    const close = first === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < source.length; i += 1) {
      const current = source[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (current === '\\') escaped = true;
        else if (current === '"') inString = false;
        continue;
      }
      if (current === '"') inString = true;
      else if (current === open) depth += 1;
      else if (current === close && --depth === 0) return i + 1;
    }
    throw new Error('Unterminated JSON value.');
  }

  let cursor = start;
  while (cursor < source.length && source[cursor] !== ',' && source[cursor] !== '}') cursor += 1;
  while (cursor > start && /\s/.test(source[cursor - 1])) cursor -= 1;
  return cursor;
}

function readStringEnd(source: string, start: number): number {
  let escaped = false;
  for (let i = start + 1; i < source.length; i += 1) {
    if (escaped) escaped = false;
    else if (source[i] === '\\') escaped = true;
    else if (source[i] === '"') return i + 1;
  }
  throw new Error('Unterminated JSON string.');
}

function insertObjectProperty(
  source: string,
  object: ObjectShape,
  key: string,
  value: Record<string, unknown>,
): string {
  const parentIndent = indentationAt(source, object.start);
  const entryIndent = object.entries[0] ? indentationAt(source, object.entries[0].keyStart) : `${parentIndent}  `;
  const property = `${JSON.stringify(key)}: ${formatValue(value, entryIndent)}`;

  if (object.entries.length === 0) {
    const originalInterior = source.slice(object.start + 1, object.end);
    if (originalInterior.trim() !== '') {
      const closingLineStart = source.lastIndexOf('\n', object.end - 1) + 1;
      if (source.slice(closingLineStart, object.end).trim() === '') {
        return replaceRange(source, closingLineStart, closingLineStart, `${entryIndent}${property}\n`);
      }
      return replaceRange(source, object.end, object.end, `\n${entryIndent}${property}\n${parentIndent}`);
    }
    return replaceRange(source, object.start + 1, object.end, `\n${entryIndent}${property}\n${parentIndent}`);
  }

  const first = object.entries[0];
  return replaceRange(source, first.keyStart, first.keyStart, `${property},\n${entryIndent}`);
}

function removeObjectEntry(source: string, object: ObjectShape, entry: ObjectEntry): string {
  const index = object.entries.indexOf(entry);
  const lineStart = source.lastIndexOf('\n', entry.keyStart - 1) + 1;
  const onlyIndentBeforeKey = source.slice(lineStart, entry.keyStart).trim() === '';
  const start = onlyIndentBeforeKey ? lineStart : entry.keyStart;

  if (entry.commaAfter !== null) {
    let end = entry.commaAfter + 1;
    while (source[end] === ' ' || source[end] === '\t') end += 1;
    if (source[end] === '\r') end += 1;
    if (source[end] === '\n') end += 1;
    return replaceRange(source, start, end, '');
  }

  if (index > 0) {
    const previousComma = object.entries[index - 1].commaAfter;
    if (previousComma !== null) return replaceRange(source, previousComma, entry.valueEnd, '');
  }
  return replaceRange(source, start, entry.valueEnd, '');
}

function formatValue(value: Record<string, unknown>, propertyIndent: string): string {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${propertyIndent}${line}`))
    .join('\n');
}

function indentationAt(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  return /^\s*/.exec(source.slice(lineStart, offset))?.[0] ?? '';
}

function skipWhitespace(source: string, start: number): number {
  let cursor = start;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  return cursor;
}

function replaceRange(source: string, start: number, end: number, replacement: string): string {
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}
