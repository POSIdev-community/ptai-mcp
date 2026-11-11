import { isOurHookCommand as isOurLaunchHookCommand } from '../launch.js';
import { asRecord } from './config-file.js';

export function hasMatching(value: unknown, identifier: string): boolean {
  return Array.isArray(value) && value.some((entry) => hasOurHook(entry, identifier));
}

export function hasNestedMcp(value: unknown, server: string, tool: string): boolean {
  return Array.isArray(value) && value.some((entry) => isOurMcpToolEntry(entry, server, tool));
}

export function removeEntries(array: unknown[], identifiers: string[]): void {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (identifiers.some((identifier) => hasOurHook(array[i], identifier))) {
      array.splice(i, 1);
    }
  }
}

export function removeCommandEntries(array: unknown[], identifier: string): void {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (hasOurHook(array[i], identifier)) {
      array.splice(i, 1);
    }
  }
}

export function hasOurHook(value: unknown, identifier: string): boolean {
  return stringValues(value).some((candidate) => isOurHookCommand(candidate, identifier));
}

export function isOurHookCommand(command: string, identifier: string): boolean {
  return isOurLaunchHookCommand(command, identifier);
}

export function isOurMcpToolEntry(value: unknown, server: string, tool: string): boolean {
  const record = asRecord(value);

  return record?.server === server && record.tool === tool
    ? true
    : Array.isArray(record?.hooks) && record.hooks.some((entry) => isOurMcpToolEntry(entry, server, tool));
}

export function removeMcpToolEntries(array: unknown[], server: string, tool: string): void {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (isOurMcpToolEntry(array[i], server, tool)) {
      array.splice(i, 1);
    }
  }
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(stringValues);
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(stringValues);
  }

  return [];
}
