import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import yazl from 'yazl';
import { prepareBundleDirectory, unpackBundle } from '../src/services/installer/extraction.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-installer-session-'));
  roots.push(root);
  const bundle = path.join(root, 'bundle');
  await fs.mkdir(bundle);
  await fs.writeFile(path.join(bundle, 'shared_variables'), 'encrypted fixture');
  await fs.writeFile(path.join(bundle, 'shared_variables.session-lock'), 'lock fixture');
  await fs.writeFile(path.join(bundle, 'old-binary'), 'obsolete');
  return { root, bundle };
}
it('replaces binaries while keeping the shared session and lock at the same inode', async () => {
  const { bundle } = await fixture();
  const before = await fs.stat(path.join(bundle, 'shared_variables'));
  await prepareBundleDirectory(bundle);
  expect(await fs.readdir(bundle)).toEqual(['shared_variables', 'shared_variables.session-lock']);
  expect(await fs.readFile(path.join(bundle, 'shared_variables'), 'utf8')).toBe('encrypted fixture');
  expect((await fs.stat(path.join(bundle, 'shared_variables'))).ino).toBe(before.ino);
  await expect(prepareBundleDirectory(path.parse(bundle).root)).rejects.toThrow('filesystem root');
});
it.runIf(process.platform === 'win32')(
  'native Windows extraction cannot overwrite the shared session from the ZIP',
  async () => {
    const { root, bundle } = await fixture();
    const archive = new yazl.ZipFile();
    const chunks: Buffer[] = [];
    const zipped = new Promise<Buffer>((resolve, reject) => {
      archive.outputStream.on('data', (chunk) => chunks.push(chunk));
      archive.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
      archive.outputStream.on('error', reject);
    });
    archive.addBuffer(Buffer.from('replacement binary'), 'McpProxy.fixture');
    archive.addBuffer(Buffer.from('must not replace'), 'shared_variables');
    archive.addBuffer(Buffer.from('must not replace'), 'shared_variables.session-lock');
    archive.end();
    const file = path.join(root, 'bundle.zip');
    await fs.writeFile(file, await zipped);
    await unpackBundle(file, bundle);
    expect(await fs.readFile(path.join(bundle, 'McpProxy.fixture'), 'utf8')).toBe('replacement binary');
    expect(await fs.readFile(path.join(bundle, 'shared_variables'), 'utf8')).toBe('encrypted fixture');
    expect(await fs.readFile(path.join(bundle, 'shared_variables.session-lock'), 'utf8')).toBe('lock fixture');
  },
  15_000,
);
