/* global process */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptai-mcp-artifact-'));

try {
  const packOutput = execFileSync(npmCommand, ['pack', '--ignore-scripts', '--json', '--pack-destination', tempDir], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const metadata = JSON.parse(packOutput.trim());
  const filename = metadata[0]?.filename;
  if (typeof filename !== 'string') throw new Error('npm pack did not report an artifact filename.');

  const artifactPath = path.join(tempDir, filename);
  const installDir = path.join(tempDir, 'install');
  execFileSync(npmCommand, ['install', '--ignore-scripts', '--prefix', installDir, artifactPath], {
    cwd: root,
    stdio: 'inherit',
  });

  const cliPath = path.join(installDir, 'node_modules', '@posidev-community', 'ptai-mcp', 'bin', 'ptai-mcp.js');
  const help = execFileSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
  if (!help.includes('Usage: ptai-mcp')) throw new Error('Packed artifact did not start the CLI successfully.');

  process.stdout.write(`Artifact smoke test passed: ${filename}\n`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
