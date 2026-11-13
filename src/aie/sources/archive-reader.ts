import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import { LIMITS } from '../../shared/limits.js';
import type { DirectoryContent } from '../../vendor/aie-v63/src/models/index.js';
import { boundedBody } from '../api/body.js';
import type { AieApi } from '../api/client.js';
import { archiveEntryPath, updateArchiveCrc } from './extract.js';

export const SourceFetch = { Direct: 'directory_or_file_api', Archive: 'branch_archive_fallback' } as const;
export type DirectoryRead = DirectoryContent & { fetch_source?: string };

export async function archiveTree(
  api: AieApi,
  projectId: string,
  branchId: string,
  path: string,
  depth: number,
): Promise<DirectoryRead> {
  path = path.normalize('NFC');
  const zip = await sourceZip(api, projectId, branchId);
  const tree: DirectoryRead = { name: path, _files: [], _directories: [], fetch_source: SourceFetch.Archive };
  const directories = new WeakMap<DirectoryContent, Map<string, DirectoryContent>>();
  let found = path === '';

  try {
    const entries = await sourceEntries(zip);

    for (const [name, entry] of entries) {
      if (name === path && entry.fileName.endsWith('/')) {
        found = true;
      }

      if (path && !name.startsWith(path + '/')) {
        continue;
      }

      const relative = path ? name.slice(path.length + 1) : name;

      if (!relative) {
        continue;
      }

      found = true;
      addPath(tree, relative.split('/'), entry.fileName.endsWith('/'), depth, directories);
    }

    if (!found) {
      throw new ToolError(ErrorCode.NotFound, 'Source directory was not found in the branch archive.');
    }

    return tree;
  } catch (error) {
    throw archiveFailure(error);
  } finally {
    zip.close();
  }
}

export async function archiveFile(api: AieApi, projectId: string, branchId: string, path: string): Promise<Buffer> {
  const zip = await sourceZip(api, projectId, branchId);

  try {
    const entry = (await sourceEntries(zip)).get(path.normalize('NFC'));

    if (!entry || entry.fileName.endsWith('/')) {
      throw new ToolError(ErrorCode.NotFound, 'Source file was not found in the branch archive.');
    }

    return await entryBody(zip, entry);
  } catch (error) {
    throw archiveFailure(error);
  } finally {
    zip.close();
  }
}

async function entryBody(zip: ZipFile, entry: Entry): Promise<Buffer> {
  if (entry.uncompressedSize > LIMITS.sourceReadBytes) {
    throw new ToolError(ErrorCode.UpstreamLimit, 'Source file exceeds 1 MiB.');
  }

  const input = await new Promise<import('node:stream').Readable>((resolve, reject) =>
    zip.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream!))),
  );

  const chunks: Buffer[] = [];
  let bytes = 0;

  try {
    for await (const chunk of input) {
      bytes += chunk.length;

      if (bytes > LIMITS.sourceReadBytes) {
        throw new ToolError(ErrorCode.UpstreamLimit, 'Source file exceeds 1 MiB.');
      }

      chunks.push(Buffer.from(chunk));
    }
  } finally {
    input.destroy();
  }

  const body = Buffer.concat(chunks, bytes);

  if (bytes !== entry.uncompressedSize || (updateArchiveCrc(0xffffffff, body) ^ 0xffffffff) >>> 0 !== entry.crc32) {
    throw new ToolError(ErrorCode.InvalidArchive, 'Source archive entry size or checksum is invalid.');
  }

  return body;
}

async function sourceZip(api: AieApi, projectId: string, branchId: string): Promise<ZipFile> {
  const response = await api.response(
    api.store.apiStoreProjectIdBranchesBranchIdSourcesGetRaw({ projectId, branchId }),
  );

  const bytes = await boundedBody(response, LIMITS.jsonBytes);

  return new Promise((resolve, reject) =>
    yauzl.fromBuffer(bytes, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (error, zip) =>
      error ? reject(new ToolError(ErrorCode.InvalidArchive, 'Invalid branch source archive.')) : resolve(zip!),
    ),
  );
}

async function sourceEntries(zip: ZipFile) {
  const entries = new Map<string, Entry>();

  for (let count = 0; ; count++) {
    const entry = await nextEntry(zip);

    if (!entry) {
      return entries;
    }

    if (count >= LIMITS.archiveEntries || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) {
      throw new ToolError(ErrorCode.ArchiveLimit, 'Source archive entry limit or symlink restriction violated.');
    }

    const path = archiveEntryPath(entry.fileName);

    if (entries.has(path)) {
      throw new ToolError(ErrorCode.InvalidArchive, 'Source archive contains colliding canonical paths.');
    }

    entries.set(path, entry);
  }
}

function nextEntry(zip: ZipFile): Promise<Entry | null> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      zip.off('entry', onEntry);
      zip.off('end', onEnd);
      zip.off('error', onError);
    };

    const onEntry = (entry: Entry) => {
      cleanup();
      resolve(entry);
    };

    const onEnd = () => {
      cleanup();
      resolve(null);
    };

    const onError = () => {
      cleanup();
      reject(new ToolError(ErrorCode.InvalidArchive, 'Invalid source archive directory.'));
    };

    zip.once('entry', onEntry);
    zip.once('end', onEnd);
    zip.once('error', onError);
    zip.readEntry();
  });
}

function addPath(
  tree: DirectoryContent,
  parts: string[],
  directory: boolean,
  depth: number,
  directories: WeakMap<DirectoryContent, Map<string, DirectoryContent>>,
) {
  tree._hasContent = true;
  const [name, ...rest] = parts;

  if (!rest.length && !directory) {
    tree._files!.push(name);

    return;
  }

  const children = directories.get(tree) ?? new Map<string, DirectoryContent>();
  directories.set(tree, children);
  let child = children.get(name);

  if (!child) {
    child = { name, _files: [], _directories: [], _hasContent: !!rest.length };
    tree._directories!.push(child);
    children.set(name, child);
  }

  if (rest.length && depth > 1) {
    addPath(child, rest, directory, depth - 1, directories);
  }
}

function archiveFailure(error: unknown) {
  return error instanceof ToolError
    ? error
    : new ToolError(ErrorCode.InvalidArchive, 'Source archive decompression failed.');
}
