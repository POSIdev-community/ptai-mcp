import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionCodec, sessionFingerprint } from '../../../src/aie/auth/session-codec.js';
import { withSessionLock } from '../../../src/aie/auth/session-lock.js';
import { SessionStorage } from '../../../src/aie/auth/session-storage.js';

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
async function file() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-lock-'));
  roots.push(root);
  return path.join(root, 'shared_variables');
}
it('serializes separate storage instances and reuses a token refreshed by the other process', async () => {
  const name = await file();
  const codec = new SessionCodec('fixture', 'machine');
  const a = new SessionStorage(name, codec);
  const b = new SessionStorage(name, codec);
  const value = { AccessToken: 'old', RefreshToken: 'refresh', EnterpriseApiUri: 'https://aie.test' };
  await a.write(value);
  const update = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
    return { ...value, AccessToken: 'new' };
  });
  const results = await Promise.all([
    a.refresh(sessionFingerprint(value), update),
    b.refresh(sessionFingerprint(value), update),
  ]);
  expect(update).toHaveBeenCalledOnce();
  expect(results.map((result) => result.AccessToken)).toEqual(['new', 'new']);
  await expect(fs.stat(`${name}.session-lock`)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('preserves a live lock regardless of age and returns a retryable busy error', async () => {
  const name = await file();
  await fs.writeFile(`${name}.session-lock`, JSON.stringify({ pid: process.pid, nonce: 'live' }));
  await fs.utimes(`${name}.session-lock`, new Date(0), new Date(0));
  await expect(withSessionLock(name, async () => undefined, 1)).rejects.toMatchObject({ code: 'AIE_SESSION_BUSY' });
  expect(JSON.parse(await fs.readFile(`${name}.session-lock`, 'utf8')).nonce).toBe('live');
});
it('recovers a dead owner and a stale partial lock but preserves a new partial record', async () => {
  const name = await file();
  vi.spyOn(process, 'kill').mockImplementation(() => {
    throw Object.assign(new Error('dead'), { code: 'ESRCH' });
  });
  await fs.writeFile(`${name}.session-lock`, JSON.stringify({ pid: 999999, nonce: 'dead' }));
  await expect(withSessionLock(name, async () => 'recovered')).resolves.toBe('recovered');
  await fs.writeFile(`${name}.session-lock`, '{');
  await fs.utimes(`${name}.session-lock`, new Date(0), new Date(0));
  await expect(withSessionLock(name, async () => 'recovered')).resolves.toBe('recovered');
  await fs.writeFile(`${name}.session-lock`, '{');
  await expect(withSessionLock(name, async () => undefined, 1)).rejects.toMatchObject({ code: 'AIE_SESSION_BUSY' });
});
it('releases the lock after action failure and never removes a replacement owner', async () => {
  const name = await file();
  await expect(
    withSessionLock(name, async () => {
      throw new Error('fixture');
    }),
  ).rejects.toThrow('fixture');
  await expect(fs.stat(`${name}.session-lock`)).rejects.toMatchObject({ code: 'ENOENT' });
  await withSessionLock(name, async () =>
    fs.writeFile(`${name}.session-lock`, JSON.stringify({ pid: process.pid, nonce: 'replacement' })),
  );
  expect(JSON.parse(await fs.readFile(`${name}.session-lock`, 'utf8')).nonce).toBe('replacement');
});
it('reports an unwritable lock parent and a deleted session during refresh', async () => {
  const name = await file();
  await expect(withSessionLock(path.join(name, 'missing'), async () => undefined)).rejects.toMatchObject({
    code: 'AIE_SESSION_UNWRITABLE',
  });
  const storage = new SessionStorage(name);
  await expect(storage.refresh('old', async (value) => value)).rejects.toMatchObject({ code: 'AIE_LOGIN_REQUIRED' });
});
