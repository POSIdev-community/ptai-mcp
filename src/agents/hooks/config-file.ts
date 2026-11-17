import fs from 'node:fs/promises';
import path from 'node:path';
import TOML from '@iarna/toml';
import { NodeErrorCode } from '../../shared/io-constants.js';

export function ensureArray(parent: Record<string, unknown>, key: string): unknown[] {
  if (Array.isArray(parent[key])) {
    return parent[key] as unknown[];
  }

  const created: unknown[] = [];
  parent[key] = created;

  return created;
}

export function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = asRecord(parent[key]);

  if (existing) {
    return existing;
  }

  const created: Record<string, unknown> = {};
  parent[key] = created;

  return created;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const source = await readOptional(filePath);

  return source === null || source.trim() === '' ? {} : (JSON.parse(source) as Record<string, unknown>);
}

export async function readJsonOptional(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === NodeErrorCode.NotFound) {
      return null;
    }

    return null;
  }
}

export async function writeJson(filePath: string, model: Record<string, unknown>): Promise<void> {
  await ensureParent(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
}

export async function readToml(filePath: string): Promise<Record<string, unknown>> {
  const source = await readOptional(filePath);

  return source === null || source.trim() === '' ? {} : (TOML.parse(source) as Record<string, unknown>);
}

export async function readTomlOptional(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return TOML.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === NodeErrorCode.NotFound) {
      return null;
    }

    return null;
  }
}

export async function writeToml(filePath: string, model: Record<string, unknown>): Promise<void> {
  await ensureParent(filePath);
  await fs.writeFile(filePath, TOML.stringify(model as TOML.JsonMap), 'utf8');
}

export async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === NodeErrorCode.NotFound) {
      return null;
    }

    throw error;
  }
}

export async function ensureParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}
