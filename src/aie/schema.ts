import { Ajv, type ValidateFunction } from 'ajv';
import { createHash } from 'node:crypto';
import { schemas } from '../vendor/aie-v63/contract.js';
import { AieError, validation } from './errors.js';

export type Data = Record<string, unknown>;
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
const validators = new Map<string, ValidateFunction>();

export function record(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) validation('Expected a JSON object.');
  return value as Data;
}

function convert(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convert);
  if (!value || typeof value !== 'object') return value;
  const source = value as Data;
  const result: Data = {};
  for (const [key, item] of Object.entries(source)) {
    if (key === 'nullable') continue;
    result[key] =
      key === '$ref' && typeof item === 'string' ? item.replace('#/components/schemas/', '#/$defs/') : convert(item);
  }
  return source.nullable ? { anyOf: [result, { type: 'null' }] } : result;
}

export function writeSchema(name: string): Data {
  const definitions: Data = {};
  function visit(current: string) {
    if (current in definitions) return;
    const schema = schemas[current];
    if (!schema) throw new AieError('AIE_SCHEMA_MISSING', 'The required write schema is not bundled.');
    definitions[current] = convert(schema);
    const text = JSON.stringify(schema);
    for (const match of text.matchAll(/#\/components\/schemas\/([^"\s]+)/g)) visit(match[1]);
  }
  visit(name);
  return { $ref: `#/$defs/${name}`, $defs: definitions };
}

export function validateWrite(name: string, value: unknown) {
  let validate = validators.get(name);
  if (!validate) {
    validate = ajv.compile(writeSchema(name));
    validators.set(name, validate);
  }
  if (!validate(value)) {
    // Only schema paths and validation keywords, never user values.
    const fields = (validate.errors ?? [])
      .slice(0, 8)
      .map((e) => `${e.instancePath || '/'}: ${e.keyword}`)
      .join('; ');
    validation(`Value does not match ${name}: ${fields}`);
  }
}

/** Read DTOs can contain server-only fields; project only the allowed write keys. */
export function writable(name: string, value: Data): Data {
  function project(schema: Data, item: unknown, depth: number): unknown {
    if (depth > 64) throw new AieError('AIE_UPSTREAM_LIMIT', 'Settings nesting exceeds the supported limit.');
    if (typeof schema.$ref === 'string') {
      const reference = schemas[schema.$ref.split('/').at(-1)!];
      if (!reference) throw new AieError('AIE_SCHEMA_MISSING', 'A referenced write schema is unavailable.');
      return project({ ...reference, ...(schema.nullable ? { nullable: true } : {}) }, item, depth + 1);
    }
    if (item === null) return schema.nullable ? null : undefined;
    if (Array.isArray(item) && schema.items)
      return item.map((entry) => project(record(schema.items), entry, depth + 1));
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const properties = schema.properties as Data | undefined;
      const output: Data = {};
      for (const [key, entry] of Object.entries(item)) {
        if (forbidden.has(key)) validation('Unsafe object key.');
        const child =
          properties?.[key] ??
          (typeof schema.additionalProperties === 'object' ? schema.additionalProperties : undefined);
        if (child && typeof child === 'object') {
          const projected = project(child as Data, entry, depth + 1);
          if (projected !== undefined) output[key] = projected;
        } else if (schema.additionalProperties === true) output[key] = entry;
      }
      return output;
    }
    return item;
  }
  const schema = schemas[name];
  if (!schema?.properties) throw new AieError('AIE_SCHEMA_MISSING', 'Expected an object write schema.');
  return record(project(schema, value, 0));
}

/** Keep unedited nested fields returned by a newer server. Callers may change
 * only schema-declared properties: validate the projected merge BEFORE this
 * step. Read-only top-level fields remain excluded by the write DTO mapping. */
export function preserveReadExtras(name: string, original: Data, validated: Data, changes: Data): Data {
  function restore(schema: Data, before: unknown, after: unknown, patch: unknown, root = false): unknown {
    if (typeof schema.$ref === 'string')
      return restore(schemas[schema.$ref.split('/').at(-1)!], before, after, patch, root);
    if (Array.isArray(after)) return patch === undefined && Array.isArray(before) ? structuredClone(before) : after;
    if (!after || typeof after !== 'object' || Array.isArray(after)) return after;
    const prior = before && typeof before === 'object' && !Array.isArray(before) ? (before as Data) : {};
    const delta = patch && typeof patch === 'object' && !Array.isArray(patch) ? (patch as Data) : {};
    const properties = schema.properties as Data | undefined;
    const output: Data = { ...after };
    if (!root && properties)
      for (const [key, value] of Object.entries(prior)) {
        if (!(key in properties) && !forbidden.has(key)) output[key] = structuredClone(value);
      }
    if (properties)
      for (const [key, value] of Object.entries(output)) {
        if (properties[key] && typeof properties[key] === 'object')
          output[key] = restore(properties[key] as Data, prior[key], value, delta[key]);
      }
    return output;
  }
  return record(restore(schemas[name], original, validated, changes, true));
}

export function merge(base: unknown, changes: unknown): unknown {
  if (Array.isArray(changes) || changes === null || typeof changes !== 'object') return structuredClone(changes);
  const current = base && typeof base === 'object' && !Array.isArray(base) ? (base as Data) : {};
  const result: Data = { ...current };
  for (const [key, value] of Object.entries(changes)) {
    if (forbidden.has(key)) validation('Unsafe object key.');
    result[key] = merge(current[key], value);
  }
  return result;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function revision(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
export function verifyRevision(value: unknown, base?: string) {
  if (base && revision(value) !== base)
    throw new AieError(
      'AIE_REVISION_CONFLICT',
      'The object changed since it was read. Read it again before applying changes.',
      { effects: 'not_applied' },
    );
}

/** Readback compares requested leaves. Additional server defaults are allowed. */
export function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return revision(actual) === revision(expected);
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
    return Object.entries(expected).every(([key, value]) => contains((actual as Data)[key], value));
  }
  return actual === expected;
}

export function checkReadback(actual: unknown, expected: unknown) {
  if (!contains(actual, expected))
    throw new AieError(
      'AIE_READBACK_MISMATCH',
      'AIE accepted the write but readback did not confirm the requested values.',
      {
        effects: 'applied',
        next_action: 'Read the current object and resolve the difference before another change.',
      },
    );
}
