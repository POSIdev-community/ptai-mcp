import fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeBundleDirectory } from '../src/commands/uninstall.js';

afterEach(() => vi.restoreAllMocks());

describe('macOS bundle removal', () => {
  it('requests administrator privileges after a permission error', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    const denied = new Error('permission denied') as NodeJS.ErrnoException;
    denied.code = 'EACCES';
    vi.spyOn(fs, 'rm').mockRejectedValue(denied);
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }));

    await removeBundleDirectory('/Library/Application-Inspector-Analyzer', run);

    expect(run).toHaveBeenCalledWith('/usr/bin/osascript', [
      '-e',
      expect.stringContaining('with administrator privileges'),
      '/Library/Application-Inspector-Analyzer',
    ]);
  });

  it('reports a cancelled or failed administrator prompt', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    const denied = new Error('permission denied') as NodeJS.ErrnoException;
    denied.code = 'EPERM';
    vi.spyOn(fs, 'rm').mockRejectedValue(denied);

    await expect(
      removeBundleDirectory(
        '/Library/Application-Inspector-Analyzer',
        vi.fn(async () => Promise.reject(new Error())),
      ),
    ).rejects.toThrow('Administrator permission is required');
  });
});
