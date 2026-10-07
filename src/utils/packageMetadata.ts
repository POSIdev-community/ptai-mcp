import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PackageMetadata {
  name?: string;
  version?: string;
  config?: {
    bundleVersion?: string;
  };
}

export function readPackageMetadata(): PackageMetadata | null {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(currentDir, '../package.json'), path.resolve(currentDir, '../../package.json')];

  for (const packagePath of candidates) {
    if (!fs.existsSync(packagePath)) continue;
    try {
      return JSON.parse(fs.readFileSync(packagePath, 'utf8')) as PackageMetadata;
    } catch {
      return null;
    }
  }

  return null;
}

export function getPackageName(): string {
  return readPackageMetadata()?.name ?? '@posidev-community/ptai-mcp';
}

export function getPackageVersion(): string {
  return readPackageMetadata()?.version ?? '1.0.0';
}
