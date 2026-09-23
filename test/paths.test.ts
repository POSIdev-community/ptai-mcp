import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBundleDir,
  getBundleExtension,
  getBackendPath,
  getExpectedBundleVersion,
  readPackageConfig,
  getProxyPath,
  readVersionsJson,
} from '../src/utils/paths.js';

describe('bundle paths', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses LOCALAPPDATA on Windows', () => {
    // Arrange
    vi.stubEnv('LOCALAPPDATA', path.join('C:', 'Users', 'tester', 'AppData', 'Local'));

    // Act & Assert
    expect(getBundleDir()).toBe(
      path.join('C:', 'Users', 'tester', 'AppData', 'Local', 'Application Inspector Analyzer'),
    );
    expect(getProxyPath()).toBe(path.join(getBundleDir(), 'McpProxy.exe'));
    expect(getBackendPath()).toBe(path.join(getBundleDir(), 'AI.PluginsBackend.exe'));
    expect(getBundleExtension()).toBe('zip');
  });

  it('reads versions.json from the bundle directory', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-paths-'));
    vi.stubEnv('LOCALAPPDATA', root);
    const bundleDir = getBundleDir();
    await fs.mkdir(bundleDir, { recursive: true });
    await fs.writeFile(
      path.join(bundleDir, 'versions.json'),
      JSON.stringify({ 'AI.INFRASTRUCTURE.INSTALLATOR': '1.2.3' }),
    );

    // Act
    const versions = readVersionsJson();

    // Assert
    expect(versions).toEqual({ 'AI.INFRASTRUCTURE.INSTALLATOR': '1.2.3' });
    await fs.rm(root, { recursive: true, force: true });
  });

  it('supports Linux and macOS locations and rejects unknown platforms', () => {
    // Arrange
    const platform = vi.spyOn(process, 'platform', 'get');

    // Act & Assert - Linux
    platform.mockReturnValue('linux');
    expect(getBundleDir()).toBe(path.join(os.homedir(), 'application-inspector-analyzer'));
    expect(getBackendPath()).toContain('AI.PluginsBackend');
    expect(getBundleExtension()).toBe('tar.gz');

    // Act & Assert - macOS
    platform.mockReturnValue('darwin');
    expect(getBundleDir()).toBe('/Library/Application-Inspector-Analyzer');
    expect(getBundleExtension()).toBe('pkg');

    // Act & Assert - unsupported
    platform.mockReturnValue('freebsd');
    expect(() => getBundleDir()).toThrow('Unsupported OS: freebsd');
    expect(() => getBundleExtension()).toThrow('Unsupported OS: freebsd');

    platform.mockRestore();
  });

  it('returns null for malformed versions and exposes the package bundle version', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-invalid-'));
    vi.stubEnv('LOCALAPPDATA', root);
    await fs.mkdir(getBundleDir(), { recursive: true });
    await fs.writeFile(path.join(getBundleDir(), 'versions.json'), '{not-json');

    // Act & Assert
    expect(readVersionsJson()).toBeNull();
    expect(getExpectedBundleVersion()).toBe('2.10.0.1396-feature-as-7163-openai-api');

    await fs.rm(root, { recursive: true, force: true });
  });

  it('handles absent versions and malformed or missing package metadata', () => {
    // Arrange
    const root = path.join(os.tmpdir(), 'ptai-mcp-no-bundle');
    vi.stubEnv('LOCALAPPDATA', root);

    // Act & Assert
    expect(readVersionsJson()).toBeNull();

    // Arrange
    const exists = vi.spyOn(syncFs, 'existsSync').mockReturnValue(true);
    const read = vi.spyOn(syncFs, 'readFileSync').mockImplementation((file) => {
      if (String(file).endsWith(`${path.sep}src${path.sep}package.json`)) return '{bad';
      return JSON.stringify({ config: { bundleVersion: 'x' } });
    });

    // Act & Assert
    expect(readPackageConfig()).toBeNull();

    // Cleanup
    read.mockRestore();

    // Arrange
    exists.mockReturnValue(false);

    // Act & Assert
    expect(readPackageConfig()).toBeNull();

    // Cleanup
    exists.mockRestore();
  });
});
