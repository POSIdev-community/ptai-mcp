import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DOWNLOAD_ABORTED_MESSAGE } from './constants.js';
import { type DownloadOptions } from './models.js';

export async function writeResponseToFile(
  response: Response,
  filePath: string,
  flags: 'a' | 'w',
  initialDownloaded: number,
  total: number,
  options: DownloadOptions,
): Promise<void> {
  if (!response.body) {
    throw new Error('Response body is empty');
  }

  if (options.signal?.aborted) {
    throw new Error(DOWNLOAD_ABORTED_MESSAGE);
  }

  const bodyStream =
    typeof (response.body as unknown as NodeJS.ReadableStream).on === 'function'
      ? (response.body as unknown as NodeJS.ReadableStream)
      : Readable.fromWeb(response.body as unknown as import('stream/web').ReadableStream);

  let downloaded = initialDownloaded;
  const progress = new Transform({
    transform(chunk: Buffer | Uint8Array, _encoding, callback) {
      downloaded += chunk.length;
      options.onProgress?.({ downloaded, total });
      callback(null, chunk);
    },
  });

  try {
    // Pipeline settles after stream cleanup, before callers remove the staging directory.
    await pipeline(bodyStream, progress, fs.createWriteStream(filePath, { flags }), { signal: options.signal });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new Error(DOWNLOAD_ABORTED_MESSAGE);
    }

    throw error;
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fsp.stat(filePath);

    return stats.isFile() ? stats.size : 0;
  } catch {
    return 0;
  }
}
