import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPackageMetadata } from './packageMetadata.js';
import { Platform } from './platform-constants.js';

export interface PackageConfig {
  config?: {
    bundleVersion?: string;
  };
}

export function getBundleDir(): string {
  const platform = process.platform;

  if (platform === Platform.Windows) {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'Application Inspector Analyzer',
    );
  }

  if (platform === Platform.MacOS) {
    return '/Library/Application-Inspector-Analyzer';
  }

  if (platform === Platform.Linux) {
    return path.resolve(os.homedir(), 'application-inspector-analyzer');
  }

  throw new Error(`Unsupported OS: ${platform}`);
}

export function getProxyPath(): string {
  const platform = process.platform;
  const bundleDir = getBundleDir();

  return path.join(bundleDir, platform === Platform.Windows ? 'McpProxy.exe' : 'McpProxy');
}

export function getVersionsPath(): string {
  return path.join(getBundleDir(), 'versions.json');
}

export function getBackendPath(): string {
  const platform = process.platform;
  const bundleDir = getBundleDir();

  return path.join(bundleDir, platform === Platform.Windows ? 'AI.PluginsBackend.exe' : 'AI.PluginsBackend');
}

export function getBundleExtension(): string {
  const platform = process.platform;

  if (platform === Platform.Windows) {
    return 'zip';
  }

  if (platform === Platform.MacOS) {
    return 'pkg';
  }

  if (platform === Platform.Linux) {
    return 'tar.gz';
  }

  throw new Error(`Unsupported OS: ${platform}`);
}

export function readVersionsJson(): Record<string, string> | null {
  const versionsPath = getVersionsPath();

  if (fs.existsSync(versionsPath)) {
    try {
      const content = fs.readFileSync(versionsPath, 'utf-8');

      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  return null;
}

export function readPackageConfig(): PackageConfig | null {
  return readPackageMetadata();
}

export function getExpectedBundleVersion(): string | null {
  return readPackageConfig()?.config?.bundleVersion ?? null;
}
