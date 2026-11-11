import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import ignore from 'ignore';
import yazl from 'yazl';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import type { InitOverrideFunction } from '../vendor/aie-v63/src/runtime.js';
import { AieError, validation } from './errors.js';
import { LIMITS } from './limits.js';
import { record } from './schema.js';

export interface PackedSources {
  file: string;
  size: number;
  ignored_files: number;
  skipped_symlinks: number;
  included_files: number;
  ignore_files: string[];
  aiproj_converted: boolean;
  cleanup(): Promise<void>;
}

function under(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function limit(maximum: number, onBytes?: (bytes: number) => void) {
  let bytes = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maximum)
        callback(new AieError('AIE_ARCHIVE_LIMIT', 'Archive transfer or extraction limit exceeded.'));
      else {
        onBytes?.(bytes);
        callback(null, chunk);
      }
    },
  });
}

async function removeOwned(directory: string, parent: string) {
  const absolute = path.resolve(directory);
  if (!under(path.resolve(parent), absolute) || !path.basename(absolute).startsWith('.ptai-mcp-'))
    throw new Error('Refusing unsafe staging cleanup.');
  await fsp.rm(absolute, { recursive: true, force: true });
}

export function convertAiproj(text: string): string {
  let value: Record<string, unknown>;
  try {
    value = record(JSON.parse(text.replace(/^\uFEFF/, '')));
  } catch {
    return validation('The included .aiproj is not a valid JSON object.');
  }
  value.Version = '1.11';
  delete value.$schema;
  delete value.JsaScriptingFolder;
  delete value.PygrepSettings;
  if (Array.isArray(value.ProgrammingLanguages))
    value.ProgrammingLanguages = [
      ...new Set(
        value.ProgrammingLanguages.map((language) => (language === 'C#' ? 'CSharp (Windows, Linux)' : language)),
      ),
    ];
  if (value.DotNetSettings && typeof value.DotNetSettings === 'object') {
    const settings = record(value.DotNetSettings);
    if (settings.ProjectType === 'WebSite') delete settings.ProjectType;
  }
  return JSON.stringify(value, null, 2);
}

async function openSource(file: string, identity: { dev: bigint; ino: bigint }) {
  const handle = await fsp.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)).catch((error) => {
    if (['ELOOP', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? ''))
      throw new AieError('AIE_SOURCE_CHANGED', 'A source file changed while it was being packaged.', {
        effects: 'not_applied',
      });
    throw error;
  });
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== identity.dev || opened.ino !== identity.ino)
      throw new AieError('AIE_SOURCE_CHANGED', 'A source file changed while it was being packaged.', {
        effects: 'not_applied',
      });
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function sourceText(file: string, identity: { dev: bigint; ino: bigint }) {
  const handle = await openSource(file, identity);
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    for await (const chunk of handle.createReadStream()) {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) validation('Source configuration files must be no larger than 1 MiB.');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await handle.close();
  }
}

export async function packSources(directory: string, signal: AbortSignal): Promise<PackedSources> {
  const root = await fsp.realpath(path.resolve(directory));
  if (!(await fsp.stat(root)).isDirectory()) validation('source_directory must be a directory.');
  const temporaryParent = os.tmpdir();
  const staging = await fsp.mkdtemp(path.join(temporaryParent, '.ptai-mcp-pack-'));
  const file = path.join(staging, 'sources.zip');
  const result: PackedSources = {
    file,
    size: 0,
    ignored_files: 0,
    skipped_symlinks: 0,
    included_files: 0,
    ignore_files: [],
    aiproj_converted: false,
    cleanup: () => removeOwned(staging, temporaryParent),
  };
  const rules: ReturnType<typeof ignore>[] = [];
  try {
    for (const name of ['.aiignore', '.ptaiignore']) {
      try {
        const ignorePath = path.join(root, name);
        const stat = await fsp.lstat(ignorePath, { bigint: true });
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024n * 1024n)
          validation('Ignore files must be regular files no larger than 1 MiB.');
        if (!under(root, await fsp.realpath(ignorePath)))
          validation('Ignore file resolved outside the selected directory.');
        rules.push(ignore().add(await sourceText(ignorePath, stat)));
        result.ignore_files.push(name);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const zip = new yazl.ZipFile();
    zip.on('error', (error) => (zip.outputStream as Readable).destroy(error));
    // Install the consumer/error handler before adding asynchronous entries.
    const written = pipeline(
      zip.outputStream,
      limit(LIMITS.archiveBytes),
      fs.createWriteStream(file, { flags: 'wx', mode: 0o600 }),
      { signal },
    );
    void written.catch(() => undefined);
    let count = 0;
    async function walk(current: string, relative: string) {
      for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
        signal.throwIfAborted();
        if (++count > LIMITS.archiveEntries)
          throw new AieError('AIE_ARCHIVE_LIMIT', 'Source tree has too many entries.');
        const name = relative ? `${relative}/${entry.name}` : entry.name;
        const absolute = path.join(current, entry.name);
        if (entry.name.toLowerCase() === '.git' || absolute === staging || entry.name.startsWith('.ptai-mcp-')) {
          result.ignored_files++;
          continue;
        }
        const stat = await fsp.lstat(absolute);
        if (stat.isSymbolicLink()) {
          result.skipped_symlinks++;
          continue;
        }
        const excluded = rules.some((rule) => rule.ignores(name + (stat.isDirectory() ? '/' : '')));
        if (excluded) {
          result.ignored_files++;
          continue;
        }
        if (stat.isDirectory()) {
          await walk(absolute, name);
          continue;
        }
        if (!stat.isFile()) {
          result.ignored_files++;
          continue;
        }
        const identity = await fsp.lstat(absolute, { bigint: true });
        if (!identity.isFile())
          throw new AieError('AIE_SOURCE_CHANGED', 'A source file changed while it was being packaged.', {
            effects: 'not_applied',
          });
        if (!under(root, await fsp.realpath(absolute)))
          validation('Source file resolved outside the selected directory.');
        if (entry.name === '.aiproj') {
          if (stat.size > 1024 * 1024) validation('.aiproj exceeds 1 MiB.');
          zip.addBuffer(Buffer.from(convertAiproj(await sourceText(absolute, identity))), name);
          result.aiproj_converted = true;
        } else {
          zip.addReadStreamLazy(name, { size: stat.size, mtime: stat.mtime }, (callback) => {
            void openSource(absolute, identity).then(
              (handle) => callback(null, handle.createReadStream()),
              (error) => callback(error, undefined!),
            );
          });
        }
        result.included_files++;
      }
    }
    try {
      await walk(root, '');
      if (!result.included_files) validation('No source files remain after exclusions.');
      zip.end();
      await written;
    } catch (error) {
      (zip.outputStream as Readable).destroy(error instanceof Error ? error : undefined);
      await written.catch(() => undefined);
      throw error;
    }
    result.size = (await fsp.stat(file)).size;
    return result;
  } catch (error) {
    await result.cleanup();
    throw error;
  }
}

export function multipartArchive(
  archive: PackedSources,
  filename: string,
  fields: Record<string, string>,
  signal: AbortSignal,
): InitOverrideFunction {
  if (/[\r\n"\\/]/.test(filename) || !filename)
    validation('Project/archive name must not contain path separators, quotes or line breaks.');
  const boundary = `ptai-${randomUUID()}`;
  let prefix = '';
  for (const [key, value] of Object.entries(fields))
    prefix += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
  prefix += `--${boundary}\r\nContent-Disposition: form-data; name="Files"; filename="${filename}"\r\nContent-Type: application/zip\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  return async ({ init }) => {
    async function* content() {
      yield Buffer.from(prefix);
      for await (const chunk of fs.createReadStream(archive.file, { signal })) yield chunk;
      yield Buffer.from(end);
    }
    return {
      ...init,
      headers: {
        ...init.headers,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(Buffer.byteLength(prefix) + archive.size + Buffer.byteLength(end)),
      },
      body: Readable.from(content()) as unknown as BodyInit,
      signal,
      duplex: 'half',
    } as RequestInit;
  };
}

export function archiveEntryPath(name: string): string {
  const normalized = name.normalize('NFC');
  if (
    !normalized ||
    normalized.includes('\\') ||
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized)
  )
    validation('Unsafe ZIP entry path.');
  const parts = normalized.replace(/\/$/, '').split('/');
  if (
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..' ||
        // eslint-disable-next-line no-control-regex -- ZIP names must reject control characters.
        /[<>:"|?*\x00-\x1f]/.test(part) ||
        /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
    )
  )
    validation('Unsafe or non-portable ZIP entry path.');
  return parts.join('/');
}

const crcTable = Array.from({ length: 256 }, (_, number) => {
  for (let bit = 0; bit < 8; bit++) number = number & 1 ? 0xedb88320 ^ (number >>> 1) : number >>> 1;
  return number >>> 0;
});

async function extract(zipPath: string, target: string, signal: AbortSignal) {
  const zip = await new Promise<ZipFile>((resolve, reject) =>
    yauzl.open(zipPath, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, file) =>
      error ? reject(error) : resolve(file!),
    ),
  );
  let count = 0;
  let files = 0;
  let total = 0;
  const names = new Set<string>();
  const tree = new Map<string, { spelling: string; directory: boolean }>();
  return new Promise<number>((resolve, reject) => {
    let pending: Promise<void> | undefined;
    let activeInput: Readable | undefined;
    let settled = false;
    const abort = () => finish(signal.reason ?? new Error('Cancelled.'));
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      if (error) activeInput?.destroy(error instanceof Error ? error : new Error('ZIP extraction failed.'));
      zip.close();
      // The caller removes staging after settlement. Wait for the active write
      // so an abort cannot race cleanup and recreate files in that directory.
      void Promise.resolve(pending)
        .catch(() => undefined)
        .then(() => (error ? reject(error) : resolve(count)));
    };
    signal.addEventListener('abort', abort, { once: true });
    zip.once('error', finish);
    zip.once('end', () =>
      files ? finish() : finish(new AieError('AIE_INVALID_ARCHIVE', 'AIE returned an empty ZIP archive.')),
    );
    zip.on('entry', (entry: Entry) => {
      pending = (async () => {
        signal.throwIfAborted();
        const relative = archiveEntryPath(entry.fileName);
        const key = relative.toLowerCase();
        if (names.has(key)) validation('ZIP contains colliding entry names.');
        names.add(key);
        if (++count > LIMITS.archiveEntries) throw new AieError('AIE_ARCHIVE_LIMIT', 'ZIP has too many entries.');
        const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
        const isDirectory = entry.fileName.endsWith('/');
        if (![0, isDirectory ? 0x4000 : 0x8000].includes(mode) || entry.generalPurposeBitFlag & 1)
          validation('ZIP links, special files and encrypted entries are not accepted.');
        const segments = relative.split('/');
        for (let index = 0; index < segments.length; index++) {
          const spelling = segments.slice(0, index + 1).join('/');
          const directory = index < segments.length - 1 || isDirectory;
          const existing = tree.get(spelling.toLowerCase());
          if (existing && (existing.spelling !== spelling || existing.directory !== directory))
            validation('ZIP contains colliding file/directory paths.');
          tree.set(spelling.toLowerCase(), { spelling, directory });
        }
        const destination = path.resolve(target, ...relative.split('/'));
        if (!under(target, destination)) validation('ZIP entry escapes the destination.');
        if (isDirectory) await fsp.mkdir(destination, { recursive: true });
        else {
          files++;
          if (entry.uncompressedSize > LIMITS.extractedBytes - total)
            throw new AieError('AIE_ARCHIVE_LIMIT', 'ZIP advertised extraction size exceeds the limit.');
          await fsp.mkdir(path.dirname(destination), { recursive: true });
          const input = await new Promise<Readable>((resolveStream, rejectStream) =>
            zip.openReadStream(entry, (error, stream) => (error ? rejectStream(error) : resolveStream(stream!))),
          );
          activeInput = input;
          let crc = 0xffffffff;
          let bytes = 0;
          const check = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              bytes += chunk.length;
              total += chunk.length;
              if (total > LIMITS.extractedBytes)
                return callback(new AieError('AIE_ARCHIVE_LIMIT', 'ZIP extraction exceeds the total byte limit.'));
              for (const byte of chunk) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
              callback(null, chunk);
            },
          });
          await pipeline(input, check, fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }), { signal });
          activeInput = undefined;
          if (bytes !== entry.uncompressedSize || (crc ^ 0xffffffff) >>> 0 !== entry.crc32)
            throw new AieError('AIE_INVALID_ARCHIVE', 'ZIP entry size or checksum is invalid.');
        }
        signal.throwIfAborted();
        if (!settled) zip.readEntry();
      })();
      void pending.catch(finish);
    });
    if (signal.aborted) abort();
    else zip.readEntry();
  });
}

export async function downloadArchive(response: Response, requestedDestination: string, signal: AbortSignal) {
  const destination = path.resolve(requestedDestination);
  const parent = await fsp.realpath(path.dirname(destination));
  const output = path.join(parent, path.basename(destination));
  try {
    await fsp.lstat(output);
    validation('Download destination already exists. Choose a new directory.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!response.body) throw new AieError('AIE_INVALID_ARCHIVE', 'AIE returned no source archive.');
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
    return { path: published, destination: output, entries, snapshot_match: 'unknown' };
  } finally {
    await removeOwned(staging, parent);
  }
}
