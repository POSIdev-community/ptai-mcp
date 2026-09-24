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
const killAnalyzerProcesses = vi.fn(async () => undefined);
vi.mock('../src/utils/processes.js', () => ({ killAnalyzerProcesses }));
const configureCommand = vi.fn(async () => undefined);
vi.mock('../src/commands/configure.js', () => ({ configureCommand }));
const removeMcp = vi.fn(async () => undefined);
const removeHooks = vi.fn(async () => undefined);
vi.mock('../src/agents/mcpConfig.js', () => ({ removeMcp }));
vi.mock('../src/agents/hooksConfig.js', () => ({ removeHooks }));
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
    // Act (Update)
    await updateCommand();

    // Assert (Update)
    expect(unpackBundle).toHaveBeenCalledWith('archive.zip', 'bundle-dir', undefined, expect.any(Function));
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

  it('preserves configuration when individual removals fail', async () => {
    // Arrange
    confirm.mockResolvedValue(true);
    removeMcp.mockRejectedValue(new Error('MCP failed'));
    removeHooks.mockRejectedValue(new Error('hooks failed'));

    // Act
    await uninstallCommand();

    // Assert
    expect(killAnalyzerProcesses).toHaveBeenCalled();
  });
});
