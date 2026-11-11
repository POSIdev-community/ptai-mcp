import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import { NodeErrorCode } from '../../shared/io-constants.js';
import { LIMITS } from '../../shared/limits.js';
import { SourceMatch } from '../projects/models.js';
import { limit, removeOwned, under } from './archive-utils.js';

const crcTable = Array.from({ length: 256 }, (_, number) => {
  for (let bit = 0; bit < 8; bit++) {
    number = number & 1 ? 0xedb88320 ^ (number >>> 1) : number >>> 1;
  }

  return number >>> 0;
});

export function archiveEntryPath(name: string): string {
  const normalized = name.normalize('NFC');

  if (isUnsafeArchivePath(normalized)) {
    validation('Unsafe ZIP entry path.');
  }

  const parts = normalized.replace(/\/$/, '').split('/');

  if (parts.some(isUnsafeArchiveSegment)) {
    validation('Unsafe or non-portable ZIP entry path.');
  }

  return parts.join('/');
}

export async function downloadArchive(response: Response, requestedDestination: string, signal: AbortSignal) {
  const destination = path.resolve(requestedDestination);
  const parent = await fsp.realpath(path.dirname(destination));
  const output = path.join(parent, path.basename(destination));

  try {
    await fsp.lstat(output);
    validation('Download destination already exists. Choose a new directory.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== NodeErrorCode.NotFound) {
      throw error;
    }
  }

  if (!response.body) {
    throw new ToolError(ErrorCode.InvalidArchive, 'AIE returned no source archive.');
  }

  const staging = await fsp.mkdtemp(path.join(parent, '.ptai-mcp-download-'));
  const archive = path.join(staging, 'sources.zip');
  const unpacked = path.join(staging, 'unpacked');

  try {
    await pipeline(
      Readable.fromWeb(response.body as never),
      limit(LIMITS.archiveBytes),
      fs.createWriteStream(archive, { flags: 'wx', mode: 0o600 }),
      { signal },
    );
    await fsp.mkdir(unpacked);
    const entries = await extract(archive, unpacked, signal);
    signal.throwIfAborted();
    // Exclusive mkdir reserves a NEW destination even if another process races us.
    await fsp.mkdir(output, { mode: 0o700 });
    const published = path.join(output, 'sources');
    await fsp.rename(unpacked, published);

    return { path: published, destination: output, entries, snapshot_match: SourceMatch.Unknown };
  } finally {
    await removeOwned(staging, parent);
  }
}

async function extractEntry(zip: ZipFile, target: string, signal: AbortSignal, state: ExtractionState, entry: Entry) {
  signal.throwIfAborted();
  const relative = archiveEntryPath(entry.fileName);
  const key = relative.toLowerCase();

  if (state.names.has(key)) {
    validation('ZIP contains colliding entry names.');
  }

  state.names.add(key);

  if (++state.count > LIMITS.archiveEntries) {
    throw new ToolError(ErrorCode.ArchiveLimit, 'ZIP has too many entries.');
  }

  const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
  const isDirectory = entry.fileName.endsWith('/');

  if (![0, isDirectory ? 0x4000 : 0x8000].includes(mode) || entry.generalPurposeBitFlag & 1) {
    validation('ZIP links, special files and encrypted entries are not accepted.');
  }

  const segments = relative.split('/');

  for (let index = 0; index < segments.length; index++) {
    const spelling = segments.slice(0, index + 1).join('/');
    const directory = index < segments.length - 1 || isDirectory;
    const existing = state.tree.get(spelling.toLowerCase());

    if (existing && (existing.spelling !== spelling || existing.directory !== directory)) {
      validation('ZIP contains colliding file/directory paths.');
    }

    state.tree.set(spelling.toLowerCase(), { spelling, directory });
  }

  const destination = path.resolve(target, ...relative.split('/'));

  if (!under(target, destination)) {
    validation('ZIP entry escapes the destination.');
  }

  if (isDirectory) {
    await fsp.mkdir(destination, { recursive: true });
  } else {
    await extractFile(zip, destination, signal, state, entry);
  }

  signal.throwIfAborted();
}

async function extract(zipPath: string, target: string, signal: AbortSignal) {
  const zip = await new Promise<ZipFile>((resolve, reject) =>
    yauzl.open(zipPath, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, file) =>
      error ? reject(error) : resolve(file!),
    ),
  );

  const state: ExtractionState = { count: 0, files: 0, total: 0, names: new Set(), tree: new Map() };

  return new Promise<number>((resolve, reject) => {
    let pending: Promise<void> | undefined;

    let settled = false;
    const abort = () => finish(signal.reason ?? new Error('Cancelled.'));

    const finish = (error?: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      signal.removeEventListener('abort', abort);

      if (error) {
        state.activeInput?.destroy(error instanceof Error ? error : new Error('ZIP extraction failed.'));
      }

      zip.close();
      // The caller removes staging after settlement. Wait for the active write
      // so an abort cannot race cleanup and recreate files in that directory.
      void Promise.resolve(pending)
        .catch(() => undefined)
        .then(() => (error ? reject(error) : resolve(state.count)));
    };

    signal.addEventListener('abort', abort, { once: true });
    zip.once('error', finish);
    zip.once('end', () =>
      state.files ? finish() : finish(new ToolError(ErrorCode.InvalidArchive, 'AIE returned an empty ZIP archive.')),
    );
    zip.on('entry', (entry: Entry) => {
      pending = extractEntry(zip, target, signal, state, entry).then(() => {
        if (!settled) {
          zip.readEntry();
        }
      });
      void pending.catch(finish);
    });

    if (signal.aborted) {
      abort();
    } else {
      zip.readEntry();
    }
  });
}

function isUnsafeArchivePath(value: string): boolean {
  return !value || value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/.test(value);
}

function isUnsafeArchiveSegment(value: string): boolean {
  return (
    !value ||
    value === '.' ||
    value === '..' ||
    // eslint-disable-next-line no-control-regex -- ZIP names must reject control characters.
    /[<>:"|?*\x00-\x1f]/.test(value) ||
    /[. ]$/.test(value) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)
  );
}

async function extractFile(
  zip: ZipFile,
  destination: string,
  signal: AbortSignal,
  state: ExtractionState,
  entry: Entry,
) {
  state.files++;

  if (entry.uncompressedSize > LIMITS.extractedBytes - state.total) {
    throw new ToolError(ErrorCode.ArchiveLimit, 'ZIP advertised extraction size exceeds the limit.');
  }

  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const input = await new Promise<Readable>((resolveStream, rejectStream) =>
    zip.openReadStream(entry, (error, stream) => (error ? rejectStream(error) : resolveStream(stream!))),
  );

  state.activeInput = input;
  let crc = 0xffffffff;
  let bytes = 0;
  const check = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      state.total += chunk.length;

      if (state.total > LIMITS.extractedBytes) {
        return callback(new ToolError(ErrorCode.ArchiveLimit, 'ZIP extraction exceeds the total byte limit.'));
      }

      for (const byte of chunk) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
      }

      callback(null, chunk);
    },
  });

  await pipeline(input, check, fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }), { signal });
  state.activeInput = undefined;

  if (bytes !== entry.uncompressedSize || (crc ^ 0xffffffff) >>> 0 !== entry.crc32) {
    throw new ToolError(ErrorCode.InvalidArchive, 'ZIP entry size or checksum is invalid.');
  }
}

interface ExtractionState {
  count: number;
  files: number;
  total: number;
  names: Set<string>;
  tree: Map<string, { spelling: string; directory: boolean }>;
  activeInput?: Readable;
}
