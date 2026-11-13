import { describe, expect, it } from 'vitest';
import yazl from 'yazl';
import { SourceReader, sourcesReady } from '../../../src/aie/sources/source-reader.js';
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
    const request = server.request;
    server.request = async (url, init) => {
      const pathname = decodeURIComponent(new URL(String(url)).pathname);
      if (pathname.includes('/fileContent/')) {
        return new Response(pathname.endsWith('/e\u0301.js') ? 'NFD file' : 'different NFC file');
      }
      return request(url, init);
    };
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
