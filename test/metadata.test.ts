import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  mcpName: string;
};
const serverJson = JSON.parse(fs.readFileSync(path.join(root, 'server.json'), 'utf8')) as {
  name: string;
  version: string;
  packages?: Array<{
    registryType?: string;
    identifier?: string;
    version?: string;
    transport?: { type?: string };
    packageArguments?: Array<{ type?: string; value?: string }>;
  }>;
};

describe('publication metadata', () => {
  it('links the MCP registry identity to the npm package', () => {
    const npmPackage = serverJson.packages?.find((entry) => entry.registryType === 'npm');

    expect(packageJson.mcpName).toBe('io.github.posidev-community/ptai-mcp');
    expect(serverJson.name).toBe(packageJson.mcpName);
    expect(serverJson.version).toBe(packageJson.version);
    expect(npmPackage).toMatchObject({
      registryType: 'npm',
      registryBaseUrl: 'https://registry.npmjs.org',
      identifier: packageJson.name,
      version: packageJson.version,
      runtimeHint: 'npx',
      runtimeArguments: [{ type: 'named', name: '--yes' }],
      transport: { type: 'stdio' },
    });
    expect(npmPackage?.packageArguments).toContainEqual({ type: 'positional', value: 'start' });
  });
});
