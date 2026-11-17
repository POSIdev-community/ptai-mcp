import { createHash } from 'node:crypto';
import { validation } from './errors.js';

const unsafeObjectKeys: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

export type JsonObject = Record<string, unknown>;

export function isUnsafeObjectKey(key: string): boolean {
  return unsafeObjectKeys.has(key);
}

export function record(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    validation('Expected a JSON object.');
  }

  return value as JsonObject;
}

export function merge(base: unknown, changes: unknown): unknown {
  if (Array.isArray(changes) || changes === null || typeof changes !== 'object') {
    return structuredClone(changes);
  }

  const current = base && typeof base === 'object' && !Array.isArray(base) ? (base as JsonObject) : {};
  const result: JsonObject = { ...current };

  for (const [key, value] of Object.entries(changes)) {
    if (isUnsafeObjectKey(key)) {
      validation('Unsafe object key.');
    }

    result[key] = merge(current[key], value);
  }

  return result;
}

export function revision(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

/** Readback compares requested leaves. Additional server defaults are allowed. */
export function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return revision(actual) === revision(expected);
  }

  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      return false;
    }

    return Object.entries(expected).every(([key, value]) => contains((actual as JsonObject)[key], value));
  }

  return actual === expected;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }

  return value;
}
