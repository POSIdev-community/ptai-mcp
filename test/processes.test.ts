import { afterEach, describe, expect, it, vi } from 'vitest';
import { killAnalyzerProcesses } from '../src/utils/processes.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('process management', () => {
  it('requests both Windows analyzer processes to stop and ignores missing processes', async () => {
    // Arrange
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    const calls: Array<[string, string[]]> = [];
    const run = vi.fn(async (file: string, args: string[]) => {
      calls.push([file, args]);
      if (args.includes('McpProxy.exe')) {
        const error = new Error('not running') as NodeJS.ErrnoException;
        error.code = '128';
        throw error;
      }
    });

    // Act
    const result = await killAnalyzerProcesses(run);

    // Assert
    expect(calls).toEqual([
      ['taskkill', ['/F', '/T', '/IM', 'AI.PluginsBackend.exe']],
      ['taskkill', ['/F', '/T', '/IM', 'McpProxy.exe']],
    ]);
    expect(result).toEqual({ stopped: ['AI.PluginsBackend.exe'], notRunning: ['McpProxy.exe'] });

    platform.mockRestore();
  });

  it('uses pkill on Unix-like systems', async () => {
    // Arrange
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    const run = vi.fn(async () => undefined);

    // Act
    await killAnalyzerProcesses(run);

    // Assert
    expect(run).toHaveBeenNthCalledWith(1, 'pkill', ['-f', 'AI.PluginsBackend']);
    expect(run).toHaveBeenNthCalledWith(2, 'pkill', ['-f', 'McpProxy']);

    platform.mockRestore();
  });

  it('does not hide unexpected process termination failures', async () => {
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    const error = new Error('permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';

    await expect(killAnalyzerProcesses(vi.fn(async () => Promise.reject(error)))).rejects.toThrow(
      'Failed to stop analyzer process',
    );
    platform.mockRestore();
  });
});
