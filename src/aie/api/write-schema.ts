import { Ajv, type ValidateFunction } from 'ajv';
import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import { contains, isUnsafeObjectKey, type JsonObject, record, revision } from '../../shared/json.js';
import { schemas } from '../../vendor/aie-v63/contract.js';
import type { WriteModels } from './models.js';

const writeSchemaCompiler = new Ajv({ strict: false, allErrors: true, validateFormats: false });

// Reuse validators for bundled schemas; session identity and credentials stay outside this module.
const compiledWriteValidators = new Map<string, ValidateFunction>();

export function writeSchema(name: string): JsonObject {
  const definitions: JsonObject = {};

  function visit(current: string) {
    if (current in definitions) {
      return;
    }

    const schema = schemas[current];

    if (!schema) {
      throw new ToolError(ErrorCode.SchemaMissing, 'The required write schema is not bundled.');
    }

    definitions[current] = convert(schema);
    const text = JSON.stringify(schema);

    for (const match of text.matchAll(/#\/components\/schemas\/([^"\s]+)/g)) {
      visit(match[1]);
    }
  }

  visit(name);

  return { $ref: `#/$defs/${name}`, $defs: definitions };
}

export function validateWrite(name: string, value: unknown) {
  let validate = compiledWriteValidators.get(name);

  if (!validate) {
    validate = writeSchemaCompiler.compile(writeSchema(name));
    compiledWriteValidators.set(name, validate);
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
export function writeDto<Name extends keyof WriteModels>(name: Name, value: JsonObject): WriteModels[Name] {
  validateWrite(name, writable(name, value));

  // The schema validates known fields. Preserve untouched fields from a newer
  // server in the actual payload; they were restored after caller validation.
  return value as unknown as WriteModels[Name];
}

/** Read DTOs can contain server-only fields; project only the allowed write keys. */
export function writable(name: string, value: JsonObject): JsonObject {
  function projectObject(schema: JsonObject, item: JsonObject, depth: number): JsonObject {
    const properties = schema.properties as JsonObject | undefined;
    const output: JsonObject = {};

    for (const [key, entry] of Object.entries(item)) {
      if (isUnsafeObjectKey(key)) {
        validation('Unsafe object key.');
      }

      const child =
        properties?.[key] ??
        (typeof schema.additionalProperties === 'object' ? schema.additionalProperties : undefined);

      if (child && typeof child === 'object') {
        const projected = project(child as JsonObject, entry, depth + 1);

        if (projected !== undefined) {
          output[key] = projected;
        }
      } else if (schema.additionalProperties === true) {
        output[key] = entry;
      }
    }

    return output;
  }

  function project(schema: JsonObject, item: unknown, depth: number): unknown {
    if (depth > 64) {
      throw new ToolError(ErrorCode.UpstreamLimit, 'Settings nesting exceeds the supported limit.');
    }

    if (typeof schema.$ref === 'string') {
      const reference = schemas[schema.$ref.split('/').at(-1)!];

      if (!reference) {
        throw new ToolError(ErrorCode.SchemaMissing, 'A referenced write schema is unavailable.');
      }

      return project({ ...reference, ...(schema.nullable ? { nullable: true } : {}) }, item, depth + 1);
    }

    if (item === null) {
      return schema.nullable ? null : undefined;
    }

    if (Array.isArray(item) && schema.items) {
      return item.map((entry) => project(record(schema.items), entry, depth + 1));
    }

    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return projectObject(schema, record(item), depth);
    }

    return item;
  }

  const schema = schemas[name];

  if (!schema?.properties) {
    throw new ToolError(ErrorCode.SchemaMissing, 'Expected an object write schema.');
  }

  return record(project(schema, value, 0));
}

/** Keep unedited nested fields returned by a newer server. Callers may change
 * only schema-declared properties: validate the projected merge BEFORE this
 * step. Read-only top-level fields remain excluded by the write DTO mapping. */
export function preserveReadExtras(
  name: string,
  original: JsonObject,
  validated: JsonObject,
  changes: JsonObject,
): JsonObject {
  return record(restore(schemas[name], original, validated, changes, true));
}

export function verifyRevision(value: unknown, base?: string) {
  if (base && revision(value) !== base) {
    throw new ToolError(
      ErrorCode.RevisionConflict,
      'The object changed since it was read. Read it again before applying changes.',
      { effects: Effects.NotApplied },
    );
  }
}

export function checkReadback(actual: unknown, expected: unknown) {
  if (!contains(actual, expected)) {
    throw new ToolError(
      ErrorCode.ReadbackMismatch,
      'AIE accepted the write but readback did not confirm the requested values.',
      {
        effects: Effects.Applied,
        next_action: 'Read the current object and resolve the difference before another change.',
      },
    );
  }
}

function restore(schema: JsonObject, before: unknown, after: unknown, patch: unknown, root = false): unknown {
  if (typeof schema.$ref === 'string') {
    return restore(schemas[schema.$ref.split('/').at(-1)!], before, after, patch, root);
  }

  if (Array.isArray(after)) {
    return patch === undefined && Array.isArray(before) ? structuredClone(before) : after;
  }

  if (!after || typeof after !== 'object') {
    return after;
  }

  return restoreObject(schema, before, record(after), patch, root);
}

function restoreObject(
  schema: JsonObject,
  before: unknown,
  after: JsonObject,
  patch: unknown,
  root: boolean,
): JsonObject {
  const properties = schema.properties as JsonObject | undefined;
  const output: JsonObject = { ...after };

  if (!properties) {
    return output;
  }

  const prior = objectOrEmpty(before);
  const delta = objectOrEmpty(patch);

  if (!root) {
    copyReadExtras(properties, prior, output);
  }

  for (const [key, value] of Object.entries(output)) {
    if (properties[key] && typeof properties[key] === 'object') {
      output[key] = restore(properties[key] as JsonObject, prior[key], value, delta[key]);
    }
  }

  return output;
}

function copyReadExtras(properties: JsonObject, before: JsonObject, output: JsonObject): void {
  for (const [key, value] of Object.entries(before)) {
    if (!(key in properties) && !isUnsafeObjectKey(key)) {
      output[key] = structuredClone(value);
    }
  }
}

function objectOrEmpty(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function convert(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(convert);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const source = value as JsonObject;
  const result: JsonObject = {};

  for (const [key, item] of Object.entries(source)) {
    if (key === 'nullable') {
      continue;
    }

    result[key] =
      key === '$ref' && typeof item === 'string' ? item.replace('#/components/schemas/', '#/$defs/') : convert(item);
  }

  return source.nullable ? { anyOf: [result, { type: 'null' }] } : result;
}
