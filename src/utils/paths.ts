import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface PackageConfig {
  config?: {
    bundleVersion?: string;
  };
}

export function getBundleDir(): string {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'Application Inspector Analyzer',
    );
  }
  if (platform === 'darwin') {
    return '/Library/Application-Inspector-Analyzer';
  }
  if (platform === 'linux') {
    return path.resolve(os.homedir(), 'application-inspector-analyzer');
  }
  throw new Error(`Unsupported OS: ${platform}`);
}

export function getProxyPath(): string {
  const platform = process.platform;
  const bundleDir = getBundleDir();
  return path.join(bundleDir, platform === 'win32' ? 'McpProxy.exe' : 'McpProxy');
}

export function getVersionsPath(): string {
  return path.join(getBundleDir(), 'versions.json');
}

export function getBackendPath(): string {
  const platform = process.platform;
  const bundleDir = getBundleDir();
  return path.join(bundleDir, platform === 'win32' ? 'AI.PluginsBackend.exe' : 'AI.PluginsBackend');
}

export function getBundleExtension(): string {
  const platform = process.platform;
  if (platform === 'win32') return 'zip';
  if (platform === 'darwin') return 'pkg';
  if (platform === 'linux') return 'tar.gz';
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
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const packageCandidates = [
    path.resolve(currentDir, '../package.json'),
    path.resolve(currentDir, '../../package.json'),
  ];

  for (const packagePath of packageCandidates) {
    if (!fs.existsSync(packagePath)) continue;

    try {
      return JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as PackageConfig;
    } catch {
      return null;
    }
  }

  return null;
}

export function getExpectedBundleVersion(): string | null {
  return readPackageConfig()?.config?.bundleVersion ?? null;
}
