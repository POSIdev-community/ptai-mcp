import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirm = vi.fn();
const log = { info: vi.fn(), step: vi.fn(), success: vi.fn() };
vi.mock('@clack/prompts', () => ({
  confirm,
  isCancel: (value: unknown) => value === Symbol.for('cancel'),
  log,
}));
const downloadBundle = vi.fn(async (options: { onProgress?: (p: { downloaded: number; total: number }) => void }) => {
  options.onProgress?.({ downloaded: 1, total: 1 });
  return { archivePath: 'archive.zip', url: 'https://example.test/archive.zip' };
});
const unpackBundle = vi.fn(async (...args: unknown[]) => {
  const onProgress = args[3] as ((progress: { extracted: number; total: number }) => void) | undefined;
  onProgress?.({ extracted: 1, total: 2 });
  onProgress?.({ extracted: 2, total: 2 });
});
vi.mock('../src/utils/downloader.js', () => ({ downloadBundle, unpackBundle }));
const killAnalyzerProcesses = vi.fn(async () => ({ stopped: [], notRunning: [] }));
vi.mock('../src/utils/processes.js', () => ({ killAnalyzerProcesses }));
const configureCommand = vi.fn(async () => undefined);
vi.mock('../src/commands/configure.js', () => ({ configureCommand }));
const removeMcp = vi.fn(async () => undefined);
const removeHooks = vi.fn(async () => undefined);
vi.mock('../src/agents/mcpConfig.js', () => ({ removeMcp }));
vi.mock('../src/agents/hooksConfig.js', () => ({ removeHooks }));
const removeCustomAgentGuide = vi.fn(async () => false);
vi.mock('../src/agents/customAgent.js', () => ({ removeCustomAgentGuide }));
const agents = [
  {
    id: 'one',
    displayName: 'One',
    supportsHooks: true,
    getMcpConfigPaths: () => ['one.json'],
    getHooksConfigPaths: () => ['hooks.json'],
  },
];
let expectedVersion: string | null = '2.0.0';
vi.mock('../src/agents/registry.js', () => ({ getSupportedAgents: () => agents }));
vi.mock('../src/utils/paths.js', () => ({
  getExpectedBundleVersion: () => expectedVersion,
  readVersionsJson: () => ({ 'AI.INFRASTRUCTURE.INSTALLATOR': '1.0.0' }),
  getProxyPath: () => 'proxy.exe',
  getVersionsPath: () => 'versions.json',
  getBundleDir: () => 'bundle-dir',
}));

const { installCommand } = await import('../src/commands/install.js');
const { updateCommand } = await import('../src/commands/update.js');
const { uninstallCommand } = await import('../src/commands/uninstall.js');

describe('install, update and uninstall commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    confirm.mockReset();
    downloadBundle.mockClear();
    unpackBundle.mockClear();
    killAnalyzerProcesses.mockClear();
    configureCommand.mockClear();
    removeMcp.mockClear();
    removeHooks.mockClear();
  });

  it('installs a fresh bundle and configures agents', async () => {
    // Arrange
    // The production macOS path keeps the .pkg archive for the native
    // installer. Exercise the cleanup branch deterministically on every CI OS.
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const rm = vi.spyOn(fs, 'rmSync').mockImplementation(() => undefined);

    // Act
    await installCommand();

    // Assert
    expect(killAnalyzerProcesses).toHaveBeenCalled();
    expect(downloadBundle).toHaveBeenCalled();
    expect(unpackBundle).toHaveBeenCalledWith('archive.zip', 'bundle-dir', undefined, expect.any(Function));
    expect(rm).toHaveBeenCalledWith('archive.zip', { force: true });
    expect(configureCommand).toHaveBeenCalled();
    platform.mockRestore();
  });

  it('skips an existing installation when not confirmed', async () => {
    // Arrange
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    confirm.mockResolvedValue(false);

    // Act
    await installCommand();

    // Assert
    expect(downloadBundle).not.toHaveBeenCalled();
  });

  it('does not reinstall an already current bundle', async () => {
    // Arrange
    expectedVersion = '1.0.0';
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    // Act
    await installCommand();
    await updateCommand();

    // Assert
    expect(downloadBundle).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith('Bundle 1.0.0 is already up to date.');

    // Cleanup
    expectedVersion = '2.0.0';
  });

  it('cancels an existing installation', async () => {
    // Arrange
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    confirm.mockResolvedValue(Symbol.for('cancel'));

    // Act
    await installCommand();

    // Assert
    expect(downloadBundle).not.toHaveBeenCalled();
  });

  it('rejects missing package metadata', async () => {
    // Arrange
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    confirm.mockResolvedValue(Symbol.for('cancel'));
    expectedVersion = null;

    // Act & Assert
    await expect(installCommand()).rejects.toThrow('Bundle version is not configured');
    await expect(updateCommand()).rejects.toThrow('Bundle version is not configured');

    // Cleanup
    expectedVersion = '2.0.0';
  });

  it('updates an installation', async () => {
    // Arrange (Update)
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const rm = vi.spyOn(fs, 'rmSync').mockImplementation(() => undefined);

    // Act (Update)
    await updateCommand();

    // Assert (Update)
    expect(unpackBundle).toHaveBeenCalledWith('archive.zip', 'bundle-dir', undefined, expect.any(Function));
    expect(rm).toHaveBeenCalledWith('archive.zip', { force: true });

    platform.mockRestore();
  });

  it('removes an installation after confirmation', async () => {
    // Arrange
    confirm.mockResolvedValue(true);

    // Act
    await uninstallCommand();

    // Assert
    expect(removeMcp).toHaveBeenCalledWith(agents[0], 'one.json');
    expect(removeHooks).toHaveBeenCalledWith(agents[0]);
  });

  it('cancels uninstall safely', async () => {
    // Arrange
    confirm.mockResolvedValue(Symbol.for('cancel'));

    // Act
    await uninstallCommand();

    // Assert
    expect(killAnalyzerProcesses).not.toHaveBeenCalled();
  });

  it('reports individual configuration cleanup failures after removing the bundle', async () => {
    // Arrange
    confirm.mockResolvedValue(true);
    removeMcp.mockRejectedValue(new Error('MCP failed'));
    removeHooks.mockRejectedValue(new Error('hooks failed'));

    // Act
    await expect(uninstallCommand()).rejects.toThrow('some agent configuration could not be cleaned');

    // Assert
    expect(killAnalyzerProcesses).toHaveBeenCalled();
  });
});
