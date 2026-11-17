import fs from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';

export function under(root: string, target: string) {
  const relative = path.relative(root, target);

  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

export function limit(maximum: number, onBytes?: (bytes: number) => void) {
  let bytes = 0;

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;

      if (bytes > maximum) {
        callback(new ToolError(ErrorCode.ArchiveLimit, 'Archive transfer or extraction limit exceeded.'));
      } else {
        onBytes?.(bytes);
        callback(null, chunk);
      }
    },
  });
}

export async function removeOwned(directory: string, parent: string) {
  const absolute = path.resolve(directory);

  if (!under(path.resolve(parent), absolute) || !path.basename(absolute).startsWith('.ptai-mcp-')) {
    throw new Error('Refusing unsafe staging cleanup.');
  }

  await fs.rm(absolute, { recursive: true, force: true });
}
