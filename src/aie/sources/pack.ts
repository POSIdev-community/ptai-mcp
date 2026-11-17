import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ignore from 'ignore';
import yazl from 'yazl';
import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import { NodeErrorCode } from '../../shared/io-constants.js';
import { LIMITS } from '../../shared/limits.js';
import { convertAiproj } from './aiproj.js';
import { limit, removeOwned, under } from './archive-utils.js';

const SOURCE_CHANGED_MESSAGE = 'A source file changed while it was being packaged.';

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

export async function packSources(directory: string, signal: AbortSignal): Promise<PackedSources> {
  const root = await fsp.realpath(path.resolve(directory));

  if (!(await fsp.stat(root)).isDirectory()) {
    validation('source_directory must be a directory.');
  }

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

  try {
    const rules = await readIgnoreRules(root, result);
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

    try {
      await walkSources({ root, staging, signal, zip, result, rules, count: 0 }, root, '');

      if (!result.included_files) {
        validation('No source files remain after exclusions.');
      }

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

async function openSource(file: string, identity: { dev: bigint; ino: bigint }) {
  const handle = await fsp.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)).catch((error) => {
    if (['ELOOP', NodeErrorCode.NotFound].includes((error as NodeJS.ErrnoException).code ?? '')) {
      throw new ToolError(ErrorCode.SourceChanged, SOURCE_CHANGED_MESSAGE, {
        effects: Effects.NotApplied,
      });
    }

    throw error;
  });

  try {
    const opened = await handle.stat({ bigint: true });

    if (!opened.isFile() || opened.dev !== identity.dev || opened.ino !== identity.ino) {
      throw new ToolError(ErrorCode.SourceChanged, SOURCE_CHANGED_MESSAGE, {
        effects: Effects.NotApplied,
      });
    }

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

      if (bytes > 1024 * 1024) {
        validation('Source configuration files must be no larger than 1 MiB.');
      }

      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await handle.close();
  }
}

async function readIgnoreRules(root: string, result: PackedSources) {
  const rules: ReturnType<typeof ignore>[] = [];

  for (const name of ['.aiignore', '.ptaiignore']) {
    try {
      const ignorePath = path.join(root, name);
      const stat = await fsp.lstat(ignorePath, { bigint: true });

      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024n * 1024n) {
        validation('Ignore files must be regular files no larger than 1 MiB.');
      }

      if (!under(root, await fsp.realpath(ignorePath))) {
        validation('Ignore file resolved outside the selected directory.');
      }

      rules.push(ignore().add(await sourceText(ignorePath, stat)));
      result.ignore_files.push(name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== NodeErrorCode.NotFound) {
        throw error;
      }
    }
  }

  return rules;
}

async function walkSources(context: PackingContext, current: string, relative: string): Promise<void> {
  const { staging, signal, result, rules } = context;

  for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
    signal.throwIfAborted();

    if (++context.count > LIMITS.archiveEntries) {
      throw new ToolError(ErrorCode.ArchiveLimit, 'Source tree has too many entries.');
    }

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
      await walkSources(context, absolute, name);
      continue;
    }

    if (!stat.isFile()) {
      result.ignored_files++;
      continue;
    }

    await packFile(context, absolute, name, stat);
  }
}

async function packFile(context: PackingContext, absolute: string, name: string, stat: fs.Stats) {
  const { root, zip, result } = context;
  const identity = await fsp.lstat(absolute, { bigint: true });

  if (!identity.isFile()) {
    throw new ToolError(ErrorCode.SourceChanged, SOURCE_CHANGED_MESSAGE, {
      effects: Effects.NotApplied,
    });
  }

  if (!under(root, await fsp.realpath(absolute))) {
    validation('Source file resolved outside the selected directory.');
  }

  if (path.basename(absolute) === '.aiproj.json') {
    if (stat.size > 1024 * 1024) {
      validation('.aiproj.json exceeds 1 MiB.');
    }

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

interface PackingContext {
  root: string;
  staging: string;
  signal: AbortSignal;
  zip: yazl.ZipFile;
  result: PackedSources;
  rules: ReturnType<typeof ignore>[];
  count: number;
}
