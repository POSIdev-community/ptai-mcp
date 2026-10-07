import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawn = vi.fn();
let expectedVersion: string | null | Error = '2.0.0';
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('../src/utils/paths.js', () => ({
  getBundleDir: () => 'C:/bundle',
  getBackendPath: () => 'C:/bundle/AI.PluginsBackend.exe',
  getVersionsPath: () => 'C:/bundle/versions.json',
  getProxyPath: () => 'C:/bundle/McpProxy.exe',
  getExpectedBundleVersion: () => {
    if (expectedVersion instanceof Error) throw expectedVersion;
    return expectedVersion;
  },
  readVersionsJson: () => ({ 'AI.INFRASTRUCTURE.INSTALLATOR': '1.0.0' }),
}));

const { resolveExitCode, startCommand } = await import('../src/commands/start.js');

describe('start command', () => {
  beforeEach(() => {
    spawn.mockReset();
    vi.restoreAllMocks();
  });

  it('reports a missing proxy and exits', () => {
    // Arrange
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    // Act & Assert
    expect(() => startCommand()).toThrow('exit:1');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('asks for an update when bundle artifacts exist but McpProxy is missing', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((file) => String(file) === 'C:/bundle');
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => startCommand()).toThrow('exit:1');
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Run 'ptai-mcp update'"));
  });

  it('starts the proxy, forwards arguments and propagates exit code', () => {
    // Arrange
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const child = new EventEmitter();
    spawn.mockReturnValue(child);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const originalArgv = process.argv;
    process.argv = ['node', 'cli', 'start', '--stdio'];
    startCommand(); // Setting up listeners

    // Act
    child.emit('exit', 7);

    // Assert
    expect(spawn).toHaveBeenCalledWith('C:/bundle/McpProxy.exe', ['--stdio'], { stdio: 'inherit', windowsHide: true });
    expect(exit).toHaveBeenCalledWith(7);

    // Cleanup
    process.argv = originalArgv;
  });

  it('maps a terminating signal to the conventional shell exit code', () => {
    expect(resolveExitCode(null, 'SIGKILL')).toBe(137);
    expect(resolveExitCode(null, null)).toBe(1);
  });

  it('handles a child process error', () => {
    // Arrange
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const child = new EventEmitter();
    spawn.mockReturnValue(child);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    startCommand(); // Setting up listeners

    // Act
    child.emit('error', new Error('cannot run'));

    // Assert
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('ignores failures while checking the installed version', () => {
    // Arrange
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    expectedVersion = new Error('metadata unavailable');
    spawn.mockReturnValue(new EventEmitter());

    // Act & Assert
    expect(() => startCommand()).not.toThrow();

    // Cleanup
    expectedVersion = '2.0.0';
  });
});
