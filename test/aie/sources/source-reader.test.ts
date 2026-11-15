import { describe, expect, it } from 'vitest';
import yazl from 'yazl';
import { sourcePath, SourceReader, sourcesReady } from '../../../src/aie/sources/source-reader.js';
import { LIMITS } from '../../../src/shared/limits.js';
import { AieFixture, ids } from '../../fixtures/aie-server.js';

const target = { project_id: ids.project, branch_id: ids.branch };
async function zipBytes(files: Array<[string, Buffer]>) {
  const zip = new yazl.ZipFile();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    zip.outputStream.on('error', reject);
  });
  for (const [name, body] of files) {
    zip.addBuffer(body, name);
  }
  zip.end();
  return done;
}
function fallback(archive: Buffer, length?: number) {
  const server = new AieFixture();
  const request = server.request;
  server.request = async (url, init) => {
    if (/\/(?:directory|file)Content\//.test(String(url))) {
      return new Response(null, { status: 404 });
    }
    if (String(url).endsWith('/sources')) {
      return new Response(new Uint8Array(archive), {
        headers: length ? { 'content-length': String(length) } : undefined,
      });
    }
    return request(url, init);
  };
  return new SourceReader(server.api());
}
describe('bounded archive source reads', () => {
  it('preserves exact Unicode names for direct file API requests', async () => {
    const server = new AieFixture();
    server.sourceFiles.set('e\u0301.js', 'NFD file');
    server.sourceFiles.set('é.js', 'different NFC file');
    const reader = new SourceReader(server.api());
    expect(await reader.file({ ...target, kind: 'file', path: 'e\u0301.js' })).toMatchObject({ content: 'NFD file' });
  });
  it('decodes BOM-marked UTF-16 archive content without classifying it as binary', async () => {
    const body = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('class Пример {}', 'utf16le')]);
    const reader = fallback(await zipBytes([['Main.cs', body]]));
    expect(await reader.file({ ...target, kind: 'file', path: 'Main.cs' })).toMatchObject({
      content: 'class Пример {}',
    });
  });
  it('rejects unknown non-UTF8 encoding instead of silently replacing source characters', async () => {
    const reader = fallback(await zipBytes([['main.js', Buffer.from([0xcf, 0xf0])]]));
    await expect(reader.file({ ...target, kind: 'file', path: 'main.js' })).rejects.toThrow('encoding');
  });
  it('rejects Unicode canonical collisions before selecting the first matching file', async () => {
    const reader = fallback(
      await zipBytes([
        ['é.js', Buffer.from('first')],
        ['e\u0301.js', Buffer.from('second')],
      ]),
    );
    await expect(reader.file({ ...target, kind: 'file', path: 'é.js' })).rejects.toMatchObject({
      code: 'AIE_INVALID_ARCHIVE',
    });
  });
  it('rejects an invalid archive header as a structured upstream archive error', async () => {
    const reader = fallback(Buffer.from('not a zip'));
    await expect(reader.tree({ ...target, kind: 'tree' })).rejects.toMatchObject({ code: 'AIE_INVALID_ARCHIVE' });
  });
  it('rejects a selected file over 1 MiB even when the archive compresses well', async () => {
    const reader = fallback(await zipBytes([['large.js', Buffer.alloc(LIMITS.sourceReadBytes + 1, 65)]]));
    await expect(reader.file({ ...target, kind: 'file', path: 'large.js' })).rejects.toMatchObject({
      code: 'AIE_UPSTREAM_LIMIT',
    });
  });
  it('bounds the compressed response before reading its body', async () => {
    const reader = fallback(Buffer.from('unused'), LIMITS.jsonBytes + 1);
    await expect(reader.tree({ ...target, kind: 'tree' })).rejects.toMatchObject({ code: 'AIE_UPSTREAM_LIMIT' });
  });
  it('normalizes decompression failures to a structured archive error', async () => {
    const bytes = await zipBytes([['main.js', Buffer.alloc(300, 65)]]);
    const dataOffset = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
    bytes[dataOffset] = 0xff;
    const reader = fallback(bytes);
    await expect(reader.file({ ...target, kind: 'file', path: 'main.js' })).rejects.toMatchObject({
      code: 'AIE_INVALID_ARCHIVE',
    });
  });
  it('does not download archives to check readiness on servers without directory routes', async () => {
    const server = new AieFixture();
    server.faults.set(`GET /api/directoryContent/${ids.project}/branches/${ids.branch}`, { status: 404 });
    server.faults.set(`GET /api/store/${ids.project}/branches/${ids.branch}/sources`, { status: 413 });
    expect(await sourcesReady(server.api(), ids.project, ids.branch)).toMatchObject({
      source_readiness: 'configured_target_and_branch_readback',
      source_directory_verified: false,
    });
    expect(await sourcesReady(server.api(), ids.project, ids.branch, 1)).toMatchObject({
      source_readiness: 'accepted_nonempty_upload_and_branch_readback',
      source_directory_verified: false,
    });
    expect(server.calls.some((call) => call.path.endsWith('/sources'))).toBe(false);
    server.hasSources = false;
    await expect(sourcesReady(server.api(), ids.project, ids.branch)).rejects.toMatchObject({
      code: 'AIE_SOURCES_NOT_READY',
    });
  });
});

describe('AIE source path routing', () => {
  it.each([undefined, ids.scan])(
    'reads nested paths with scan context %s without decoding a complete URL',
    async (scan_id) => {
      const server = new AieFixture();
      const reader = new SourceReader(server.api());
      for (const file of [
        'core/appHandler.js',
        'routes/app.js',
        'папка %/имя с пробелом.js',
        'src/literal%2Fname.js',
        'src/a#b?.js',
      ]) {
        server.sourceFiles.set(file, `source: ${file}`);
        expect(await reader.file({ ...target, scan_id, kind: 'file', path: `./${file}` })).toMatchObject({
          path: file,
          content: `source: ${file}`,
          content_source: 'current_branch_sources_or_temp',
          snapshot_match: 'unknown',
        });
      }
      const files = server.calls.filter((call) => call.path.includes('/fileContent/'));
      expect(files).toHaveLength(5);
      expect(files.every((call) => (scan_id ? call.path.endsWith('/VfsNode') : call.path.includes('\\')))).toBe(true);
      expect(server.calls.some((call) => call.path.endsWith('/sources'))).toBe(false);
    },
  );

  it('models encoded slashes as a literal route value rather than a nested filename', async () => {
    const server = new AieFixture();
    server.sourceFiles.set('core/appHandler.js', 'nested source');
    const api = server.api();
    await expect(
      api.response(
        api.files.apiFileContentProjectIdBranchesBranchIdFileGetRaw({
          projectId: ids.project,
          branchId: ids.branch,
          file: 'core/appHandler.js',
        }),
      ),
    ).rejects.toMatchObject({ code: 'AIE_SERVER_ERROR' });
    expect(server.calls.at(-1)?.path).toContain('core%2FappHandler.js');
  });

  it('normalizes dot and Windows separators for nested directory and file requests', async () => {
    const server = new AieFixture();
    server.sourceFiles.set('папка %/deep/app.js', 'nested source');
    const reader = new SourceReader(server.api());
    expect(await reader.tree({ ...target, kind: 'tree', path: './папка %\\deep/', depth: 2 })).toMatchObject({
      items: [{ path: 'папка %/deep/app.js', kind: 'file' }],
      metadata: { fetch_source: 'directory_or_file_api' },
    });
    expect(await reader.file({ ...target, kind: 'file', path: '.\\папка %\\deep\\app.js' })).toMatchObject({
      content: 'nested source',
      path: 'папка %/deep/app.js',
    });
    expect(server.calls.some((call) => call.path.includes('папка %\\deep'))).toBe(true);
  });

  it.each(['../server.js', './core/../server.js', '/etc/passwd', '\\\\server\\share', 'C:\\file.js', 'core/\0.js'])(
    'rejects unsafe source paths: %s',
    (path) => {
      expect(() => sourcePath(path)).toThrow('relative');
    },
  );

  it('checks that an explicit scan belongs to the selected branch before fetching a file', async () => {
    const server = new AieFixture();
    server.scans.get(ids.scan)!.branchId = ids.agent;
    await expect(
      new SourceReader(server.api()).file({ ...target, scan_id: ids.scan, kind: 'file', path: 'main.js' }),
    ).rejects.toMatchObject({ code: 'AIE_TARGET_MISMATCH' });
    expect(server.calls.some((call) => call.path.includes('/fileContent/'))).toBe(false);
  });

  it.each([403, 500])('does not mask HTTP %s with archive fallback', async (status) => {
    for (const scan_id of [undefined, ids.scan]) {
      const server = new AieFixture();
      const path = scan_id
        ? `/api/fileContent/${ids.project}/scanResults/${ids.scan}/VfsNode`
        : `/api/fileContent/${ids.project}/branches/${ids.branch}/core\\app.js`;
      server.faults.set(`GET ${path}`, { status, body: {} });
      await expect(
        new SourceReader(server.api()).file({ ...target, scan_id, kind: 'file', path: 'core/app.js' }),
      ).rejects.toMatchObject({ details: { http_status: status } });
      expect(server.calls.some((call) => call.path.endsWith('/sources'))).toBe(false);
    }
  });

  it.each([403, 500])('does not mask nested directory HTTP %s with archive fallback', async (status) => {
    const server = new AieFixture();
    server.faults.set(`GET /api/directoryContent/${ids.project}/branches/${ids.branch}/core\\nested`, {
      status,
      body: {},
    });
    await expect(
      new SourceReader(server.api()).tree({ ...target, kind: 'tree', path: './core/nested' }),
    ).rejects.toMatchObject({ details: { http_status: status } });
    expect(server.calls.some((call) => call.path.endsWith('/sources'))).toBe(false);
  });

  it.each(['missing.js', 'core/missing.js'])('preserves the server missing-file error for %s', async (file) => {
    const server = new AieFixture();
    for (const scan_id of [undefined, ids.scan]) {
      await expect(
        new SourceReader(server.api()).file({ ...target, scan_id, kind: 'file', path: file }),
      ).rejects.toMatchObject({ details: { http_status: 500 } });
    }
    expect(server.calls.some((call) => call.path.endsWith('/sources'))).toBe(false);
  });

  it('keeps normalized nested paths when falling back from an unavailable directory API', async () => {
    const reader = fallback(await zipBytes([['core/nested/app.js', Buffer.from('nested source')]]));
    expect(await reader.tree({ ...target, kind: 'tree', path: './core\\nested/' })).toMatchObject({
      items: [{ path: 'core/nested/app.js', kind: 'file' }],
      metadata: { fetch_source: 'branch_archive_fallback' },
    });
  });

  it('keeps archive fallback when the scan-context file endpoint is unsupported', async () => {
    const server = new AieFixture();
    server.faults.set(`GET /api/fileContent/${ids.project}/scanResults/${ids.scan}/VfsNode`, { status: 404 });
    expect(
      await new SourceReader(server.api()).file({ ...target, scan_id: ids.scan, kind: 'file', path: './main.js' }),
    ).toMatchObject({ content: 'synthetic source', fetch_source: 'branch_archive_fallback', path: 'main.js' });
  });

  it.each([undefined, ids.scan])('preserves line and byte limits with scan context %s', async (scan_id) => {
    const server = new AieFixture();
    const file = 'core/large.js';
    const reader = new SourceReader(server.api());
    server.sourceFiles.set(file, Array.from({ length: 250 }, (_, line) => `line ${line + 1}`).join('\n'));
    expect(await reader.file({ ...target, scan_id, kind: 'file', path: file })).toMatchObject({
      returned_lines: 200,
      end_line: 200,
      total_lines: 250,
      truncated: true,
    });
    server.sourceFiles.set(file, `first\n${'é'.repeat(LIMITS.sourceResponseBytes)}\nlast`);
    const selected = await reader.file({ ...target, scan_id, kind: 'file', path: file, start_line: 2, end_line: 2 });
    expect(selected).toMatchObject({ start_line: 2, end_line: 2, returned_lines: 1, total_lines: 3, truncated: true });
    expect(Buffer.byteLength(selected.content)).toBeLessThanOrEqual(LIMITS.sourceResponseBytes);
    expect(selected.content).not.toContain('\ufffd');
    server.sourceFiles.set(file, new Uint8Array(LIMITS.sourceReadBytes + 1));
    await expect(reader.file({ ...target, scan_id, kind: 'file', path: file })).rejects.toMatchObject({
      code: 'AIE_UPSTREAM_LIMIT',
    });
  });
});
