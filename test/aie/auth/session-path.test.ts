import syncFs from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sessions } from '../../../src/aie/auth/session.js';
import { getSessionFile } from '../../../src/aie/auth/session-path.js';
import { SessionStorage } from '../../../src/aie/auth/session-storage.js';
import { getBundleDir } from '../../../src/utils/paths.js';

const sharedDirectory = '/Library/Application-Inspector-Analyzer';
const shared = { EnterpriseApiUri: 'https://example.com', AccessToken: 'test-access', RefreshToken: 'test-refresh' };
let home: string;
let bundleExists: boolean;
const services: Sessions[] = [];

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'aie-session-path-'));
  bundleExists = false;
  vi.spyOn(os, 'homedir').mockReturnValue(home);
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  const exists = syncFs.existsSync.bind(syncFs);
  vi.spyOn(syncFs, 'existsSync').mockImplementation((file) =>
    String(file) === sharedDirectory ? bundleExists : exists(file),
  );
});

afterEach(async () => {
  for (const service of services.splice(0)) {
    service.close();
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

describe('AIE session location without a local analyzer', () => {
  it('persists and clears the default macOS session without creating the system bundle directory', async () => {
    const service = new Sessions();
    services.push(service);
    const expected = path.join(home, 'Library', 'Application Support', 'Application Inspector MCP', 'shared_variables');
    expect(service.storage.file).toBe(expected);
    expect(getBundleDir()).toBe(sharedDirectory);
    const mkdir = vi.spyOn(fs, 'mkdir');
    await service.initialize();
    await service.storage.write(shared);
    expect(mkdir).toHaveBeenCalledWith(path.dirname(expected), { recursive: true, mode: 0o700 });
    expect(mkdir.mock.calls.every(([directory]) => String(directory) !== sharedDirectory)).toBe(true);

    const restarted = new Sessions();
    services.push(restarted);
    expect(await restarted.storage.read()).toEqual(shared);
    await restarted.storage.clear();
    expect(await service.storage.read()).toBeNull();
  });

  it('prefers an existing bundle directory even when a user session already exists', async () => {
    const userFile = getSessionFile();
    await new SessionStorage(userFile).write(shared);
    bundleExists = true;
    expect(new Sessions().storage.file).toBe(path.join(sharedDirectory, 'shared_variables'));
    expect(await new SessionStorage(userFile).read()).toEqual(shared);
  });

  it.each(['win32', 'linux'] as const)('keeps the existing user-writable bundle path on %s', (platform) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue(platform);
    vi.stubEnv('LOCALAPPDATA', path.join(home, 'localappdata'));
    expect(getSessionFile()).toBe(path.join(getBundleDir(), 'shared_variables'));
  });

  it('reports a directory creation failure as a session storage error', async () => {
    const blocked = path.join(home, 'blocked');
    await fs.writeFile(blocked, 'not a directory');
    const storage = new SessionStorage(path.join(blocked, 'shared_variables'));
    await expect(storage.write(shared)).rejects.toMatchObject({ code: 'AIE_SESSION_UNWRITABLE' });
  });
});
