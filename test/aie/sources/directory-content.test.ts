import { describe, expect, it } from 'vitest';
import { directoryContent } from '../../../src/aie/sources/directory-content.js';
import { SourceReader, sourcesReady } from '../../../src/aie/sources/source-reader.js';
import { AieFixture, ids } from '../../fixtures/aie-server.js';

const target = { project_id: ids.project, branch_id: ids.branch };
const current = { name: 'app', directories: [], fileNames: ['products.ejs'], hasContent: true };
const legacy = { name: 'app', _directories: [], _files: ['products.ejs'], _hasContent: true };

describe('directory wire contracts', () => {
  it('normalizes both confirmed wire formats without changing filenames', () => {
    expect(directoryContent(current)).toEqual(legacy);
    expect(directoryContent(legacy)).toEqual(legacy);
    expect(current.fileNames).toEqual(['products.ejs']);
  });

  it.each([undefined, null])('accepts an unnamed legacy root but requires named children: %j', (name) => {
    expect(directoryContent({ ...legacy, name })).toEqual({ ...legacy, name: '' });
    expect(() => directoryContent({ ...legacy, _directories: [{ ...legacy, name }] })).toThrow(
      expect.objectContaining({ code: 'AIE_INVALID_RESPONSE' }),
    );
    expect(() => directoryContent({ ...current, name })).toThrow('malformed');
  });

  it('normalizes recursive current nodes including empty and depth-limited directories', () => {
    expect(
      directoryContent({
        ...current,
        directories: [
          { ...current, name: 'nested' },
          { name: 'empty', directories: [], fileNames: [], hasContent: false },
          { name: 'unexpanded', directories: [], fileNames: [], hasContent: true },
        ],
      }),
    ).toEqual({
      ...legacy,
      _directories: [
        { ...legacy, name: 'nested' },
        { name: 'empty', _directories: [], _files: [], _hasContent: false },
        { name: 'unexpanded', _directories: [], _files: [], _hasContent: true },
      ],
    });
  });

  it('accepts legacy null arrays and partial nested leaves without accepting an unknown root', () => {
    const tree = directoryContent({
      ...legacy,
      _directories: [
        { name: 'null', _directories: null, _files: null, _hasContent: false },
        { name: 'unexpanded', _hasContent: true },
        { name: 'partial' },
      ],
    });
    expect(tree._directories).toEqual([
      { name: 'null', _directories: [], _files: [], _hasContent: false },
      { name: 'unexpanded', _directories: [], _files: [], _hasContent: true },
      { name: 'partial', _directories: [], _files: [], _hasContent: undefined },
    ]);
    expect(() => directoryContent({ name: 'unknown' })).toThrow('unsupported');
  });

  it.each([
    null,
    [],
    {},
    { ...current, fileNames: 'wrong' },
    { ...current, fileNames: [42] },
    { ...current, directories: [null] },
    { ...current, hasContent: 'true' },
    { ...current, fileNames: undefined },
    { ...legacy, _files: 42 },
    { ...legacy, _hasContent: null },
    { ...current, _files: [] },
  ])('rejects malformed or unknown responses explicitly: %j', (value) => {
    expect(() => directoryContent(value)).toThrow(expect.objectContaining({ code: 'AIE_INVALID_RESPONSE' }));
  });

  it.each([false, true])('reads nested actual wire arrays with current format=%s', async (currentDirectoryFormat) => {
    const server = new AieFixture();
    server.currentDirectoryFormat = currentDirectoryFormat;
    for (const file of [
      'products.ejs',
      'admin.ejs',
      'useredit.ejs',
      'modifyproduct.ejs',
      'bulkproducts.ejs',
      'usersearch.ejs',
      'ping.ejs',
      'adminusers.ejs',
      'calc.ejs',
    ]) {
      server.sourceFiles.set(`views/app/${file}`, 'synthetic');
    }
    const tree = await new SourceReader(server.api()).tree({ ...target, kind: 'tree', path: 'views/app' });
    expect(tree.items).toHaveLength(9);
    expect(tree.items).toContainEqual({ path: 'views/app/products.ejs', kind: 'file' });
    expect(tree.metadata).toMatchObject({ depth: 1, fetch_source: 'directory_or_file_api' });
    expect(await sourcesReady(server.api(), ids.project, ids.branch)).toMatchObject({
      source_directory_verified: true,
    });
    const deeper = await new SourceReader(server.api()).tree({ ...target, kind: 'tree', path: 'views', depth: 2 });
    expect(deeper.items).toHaveLength(10);
    const shallow = await new SourceReader(server.api()).tree({ ...target, kind: 'tree', path: 'views', depth: 1 });
    expect(shallow.items).toEqual([{ path: 'views/app', kind: 'tree' }]);
    server.sourceFiles.clear();
    expect((await new SourceReader(server.api()).tree({ ...target, kind: 'tree' })).items).toEqual([]);
    await expect(sourcesReady(server.api(), ids.project, ids.branch)).rejects.toMatchObject({
      code: 'AIE_SOURCES_NOT_READY',
    });
  });

  it('does not turn an unknown successful response into an empty tree or weaker readiness proof', async () => {
    const server = new AieFixture();
    server.faults.set(`GET /api/directoryContent/${ids.project}/branches/${ids.branch}`, {
      status: 200,
      body: { name: 'unexpected', renamedFiles: [] },
    });
    await expect(new SourceReader(server.api()).tree({ ...target, kind: 'tree' })).rejects.toMatchObject({
      code: 'AIE_INVALID_RESPONSE',
    });
    await expect(sourcesReady(server.api(), ids.project, ids.branch)).rejects.toMatchObject({
      code: 'AIE_INVALID_RESPONSE',
    });
    expect(server.calls.some((call) => call.path.endsWith('/sources'))).toBe(false);
  });
});
