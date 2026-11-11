import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import yauzl from 'yauzl';
import yazl from 'yazl';
import { convertAiproj } from '../../../src/aie/sources/aiproj.js';
import { archiveEntryPath, downloadArchive } from '../../../src/aie/sources/extract.js';
import { multipartArchive } from '../../../src/aie/sources/multipart.js';
import { packSources } from '../../../src/aie/sources/pack.js';

const temporary: string[] = [];
async function root() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-archives-'));
  temporary.push(directory);
  return directory;
}
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function zip(entries: Array<{ name: string; body?: string; mode?: number }>) {
  const archive = new yazl.ZipFile();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.outputStream.on('data', (chunk) => chunks.push(chunk));
    archive.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    archive.outputStream.on('error', reject);
  });
  for (const entry of entries) {
    if (entry.name.endsWith('/')) {
      archive.addEmptyDirectory(entry.name);
    } else {
      archive.addBuffer(Buffer.from(entry.body ?? 'data'), entry.name, { mode: entry.mode });
    }
  }
  archive.end();
  return done;
}
async function contents(file: string) {
  const buffer = await fs.readFile(file);
  const archive = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, value) => (error ? reject(error) : resolve(value!))),
  );
  return new Promise<Record<string, string>>((resolve, reject) => {
    const entries: Record<string, string> = {};
    archive.on('entry', (entry) => {
      archive.openReadStream(entry, (error, stream) => {
        if (error) {
          return reject(error);
        }
        const chunks: Buffer[] = [];
        stream!.on('data', (chunk) => chunks.push(chunk));
        stream!.on('error', reject);
        stream!.on('end', () => {
          entries[entry.fileName] = Buffer.concat(chunks).toString('utf8');
          archive.readEntry();
        });
      });
    });
    archive.on('error', reject);
    archive.on('end', () => resolve(entries));
    archive.readEntry();
  });
}

describe('source upload packaging', () => {
  it.each(['source.js', '.aiproj.json', '.aiignore'])(
    'rejects a replaced %s between path validation and opening the file',
    async (name) => {
      const source = await root();
      const outside = await root();
      const file = path.join(source, name);
      const privateFile = path.join(outside, 'private.json');
      await fs.writeFile(file, name === '.aiproj.json' ? '{"Version":"1.12"}' : '# own fixture');
      if (name !== 'source.js') {
        await fs.writeFile(path.join(source, 'source.js'), 'safe fixture');
      }
      await fs.writeFile(privateFile, '{"outside":"synthetic private fixture"}');
      const originalOpen = fs.open.bind(fs);
      let replaced = false;
      const open = vi.spyOn(fs, 'open').mockImplementation(async (target, flags, mode) => {
        if (String(target) === file && !replaced) {
          replaced = true;
          await fs.rename(file, `${file}.before-swap`);
          try {
            await fs.symlink(privateFile, file, 'file');
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EPERM') {
              throw error;
            }
            await fs.copyFile(privateFile, file);
          }
        }
        return originalOpen(target, flags, mode);
      });
      try {
        await expect(packSources(source, new AbortController().signal)).rejects.toMatchObject({
          code: 'AIE_SOURCE_CHANGED',
        });
        expect(replaced).toBe(true);
      } finally {
        open.mockRestore();
      }
    },
  );
  it('combines both ignore files, preserves negation order and always excludes .git', async () => {
    const source = await root();
    await fs.mkdir(path.join(source, '.git'));
    await fs.mkdir(path.join(source, 'build'));
    await fs.writeFile(path.join(source, '.git', 'config'), 'private git data');
    await fs.writeFile(path.join(source, '.aiignore'), '# comment\nshared.txt\nbuild/*\n!build/keep.txt\n!.git/\n');
    await fs.writeFile(path.join(source, '.ptaiignore'), '!shared.txt\nother.txt\n');
    for (const name of ['shared.txt', 'other.txt', 'good.js', 'build/drop.txt', 'build/keep.txt']) {
      await fs.writeFile(path.join(source, name), name);
    }
    const archive = await packSources(source, new AbortController().signal);
    try {
      const entries = await contents(archive.file);
      expect(Object.keys(entries)).toEqual(expect.arrayContaining(['good.js', 'build/keep.txt']));
      for (const name of ['shared.txt', 'other.txt', '.git/config', 'build/drop.txt']) {
        expect(entries).not.toHaveProperty(name);
      }
      expect(archive.ignore_files).toEqual(['.aiignore', '.ptaiignore']);
    } finally {
      await archive.cleanup();
    }
  });
  it('converts .aiproj.json in the ZIP without changing the local file', async () => {
    const source = await root();
    const original = JSON.stringify({
      Version: '1.12',
      $schema: 'local',
      ProgrammingLanguages: ['C#'],
      PygrepSettings: {},
      JsaScriptingFolder: 'scripts',
      DotNetSettings: { ProjectType: 'WebSite', SolutionFile: 'app.sln' },
    });
    await fs.writeFile(path.join(source, '.aiproj.json'), original);
    const archive = await packSources(source, new AbortController().signal);
    try {
      const entries = await contents(archive.file);
      expect(JSON.parse(entries['.aiproj.json'])).toEqual({
        Version: '1.11',
        ProgrammingLanguages: ['CSharp (Windows, Linux)'],
        DotNetSettings: { SolutionFile: 'app.sln' },
      });
      expect(await fs.readFile(path.join(source, '.aiproj.json'), 'utf8')).toBe(original);
      expect(archive.aiproj_converted).toBe(true);
    } finally {
      await archive.cleanup();
    }
  });
  it('refuses an invalid .aiproj.json before an archive can be uploaded', async () => {
    const source = await root();
    await fs.writeFile(path.join(source, '.aiproj.json'), 'not json');
    await expect(packSources(source, new AbortController().signal)).rejects.toMatchObject({
      code: 'AIE_VALIDATION_ERROR',
    });
    expect(await fs.readFile(path.join(source, '.aiproj.json'), 'utf8')).toBe('not json');
  });
  it('refuses invalid .aiproj.json, an empty source tree and a cancelled packaging request', async () => {
    expect(() => convertAiproj('not json')).toThrow();
    const source = await root();
    await expect(packSources(source, new AbortController().signal)).rejects.toThrow('No source files');
    await fs.writeFile(path.join(source, 'file'), 'data');
    const controller = new AbortController();
    controller.abort();
    await expect(packSources(source, controller.signal)).rejects.toThrow();
  });
  it('streams multipart with an explicit filename, exact length and fields', async () => {
    const source = await root();
    await fs.writeFile(path.join(source, 'file.js'), 'source');
    const archive = await packSources(source, new AbortController().signal);
    try {
      const override = multipartArchive(archive, 'AIDT-3421.zip', { Name: 'main' }, new AbortController().signal);
      const init = await override({
        init: { method: 'POST', headers: { Authorization: 'Bearer synthetic' } },
        context: { path: '/test', method: 'POST', headers: {} },
      });
      const chunks: Buffer[] = [];
      for await (const chunk of init.body as unknown as Readable) {
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);
      const headers = init.headers as Record<string, string>;
      expect(body.length).toBe(Number(headers['Content-Length']));
      expect(body.toString('utf8')).toContain('name="Files"; filename="AIDT-3421.zip"');
      expect(body.toString('utf8')).toContain('name="Name"\r\n\r\nmain');
      expect(headers.Authorization).toBe('Bearer synthetic');
      expect(() => multipartArchive(archive, 'bad\r\nname', {}, new AbortController().signal)).toThrow();
    } finally {
      await archive.cleanup();
    }
  });
});

describe('safe archive extraction', () => {
  it.each([
    '../file',
    'a/../file',
    '/absolute',
    '//server/share',
    'C:/drive',
    'C:drive',
    'a\\file',
    'NUL.txt',
    'file:stream',
    'name.',
    'name ',
    'a//file',
    './file',
  ])('rejects unsafe path %s', (entry) => expect(() => archiveEntryPath(entry)).toThrow());
  it('validates before publishing a new local directory and never overwrites an existing destination', async () => {
    const parent = await root();
    const destination = path.join(parent, 'download');
    const data = await zip([{ name: 'src/main.js', body: 'synthetic source' }]);
    const saved = await downloadArchive(new Response(new Uint8Array(data)), destination, new AbortController().signal);
    expect(saved.snapshot_match).toBe('unknown');
    expect(await fs.readFile(path.join(saved.path, 'src', 'main.js'), 'utf8')).toBe('synthetic source');
    await expect(
      downloadArchive(new Response(new Uint8Array(data)), destination, new AbortController().signal),
    ).rejects.toThrow('already exists');
    expect((await fs.readdir(parent)).filter((name) => name.startsWith('.ptai-mcp-'))).toEqual([]);
  });
  it.each([
    { entries: [{ name: 'file' }, { name: 'FILE' }] },
    { entries: [{ name: 'dir/a' }, { name: 'DIR/b' }] },
    { entries: [{ name: 'file' }, { name: 'file/child' }] },
    { entries: [{ name: 'link', mode: 0o120777 }] },
  ])('rejects colliding paths, implicit directory collisions and symlinks', async ({ entries }) => {
    const parent = await root();
    const destination = path.join(parent, 'download');
    const data = await zip(entries);
    await expect(
      downloadArchive(new Response(new Uint8Array(data)), destination, new AbortController().signal),
    ).rejects.toThrow();
    await expect(fs.stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects empty, directory-only and non-ZIP payloads without publishing', async () => {
    const parent = await root();
    for (const data of [await zip([]), await zip([{ name: 'empty/' }]), Buffer.from('not a zip')]) {
      await expect(
        downloadArchive(
          new Response(new Uint8Array(data)),
          path.join(parent, 'download'),
          new AbortController().signal,
        ),
      ).rejects.toThrow();
    }
    expect(await fs.readdir(parent)).toEqual([]);
  });
});
