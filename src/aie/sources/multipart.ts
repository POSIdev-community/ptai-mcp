import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { validation } from '../../shared/errors.js';
import { HttpHeader } from '../../shared/http-constants.js';
import type { InitOverrideFunction } from '../api/contracts.js';
import type { PackedSources } from './pack.js';

export function multipartArchive(
  archive: PackedSources,
  filename: string,
  fields: Record<string, string>,
  signal: AbortSignal,
): InitOverrideFunction {
  if (/[\r\n"\\/]/.test(filename) || !filename) {
    validation('Project/archive name must not contain path separators, quotes or line breaks.');
  }

  const boundary = `ptai-${randomUUID()}`;
  let prefix = '';

  for (const [key, value] of Object.entries(fields)) {
    prefix += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
  }

  prefix += `--${boundary}\r\nContent-Disposition: form-data; name="Files"; filename="${filename}"\r\nContent-Type: application/zip\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;

  return async ({ init }) => {
    async function* content() {
      yield Buffer.from(prefix);

      for await (const chunk of fs.createReadStream(archive.file, { signal })) {
        yield chunk;
      }

      yield Buffer.from(end);
    }

    return {
      ...init,
      headers: {
        ...init.headers,
        [HttpHeader.ContentType]: `multipart/form-data; boundary=${boundary}`,
        [HttpHeader.ContentLength]: String(Buffer.byteLength(prefix) + archive.size + Buffer.byteLength(end)),
      },
      body: Readable.from(content()) as unknown as BodyInit,
      signal,
      duplex: 'half',
    } as RequestInit;
  };
}
