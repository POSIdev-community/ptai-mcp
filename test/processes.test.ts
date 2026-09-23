import { describe, expect, it, vi } from 'vitest';
import { killAnalyzerProcesses } from '../src/utils/processes.js';

describe('process management', () => {
  it('requests both Windows analyzer processes to stop and ignores missing processes', async () => {
    // Arrange
    const calls: Array<[string, string[]]> = [];
    const run = vi.fn(async (file: string, args: string[]) => {
      calls.push([file, args]);
      if (args.includes('McpProxy.exe')) throw new Error('not running');
    });

    // Act
    await killAnalyzerProcesses(run);

    // Assert
    expect(calls).toEqual([
      ['taskkill', ['/F', '/IM', 'AI.PluginsBackend.exe']],
      ['taskkill', ['/F', '/IM', 'McpProxy.exe']],
    ]);
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
});
