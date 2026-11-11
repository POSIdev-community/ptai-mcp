import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check using npm run smoke:artifact.');
const npm = (args) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    env: { ...process.env, HUSKY: '0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptai-mcp-artifact-'));

try {
  const packOutput = npm(['pack', '--ignore-scripts', '--json', '--pack-destination', tempDir]);
  // npm can prepend prepare-hook output even with --ignore-scripts.
  const packJson = packOutput.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/)?.[0];
  if (!packJson) throw new Error('npm pack did not report artifact metadata.');
  const metadata = JSON.parse(packJson);
  const filename = metadata[0]?.filename;
  if (typeof filename !== 'string') throw new Error('npm pack did not report an artifact filename.');

  const artifactPath = path.join(tempDir, filename);
  const installDir = path.join(tempDir, 'install');
  npm([
    'install',
    '--ignore-scripts',
    '--engine-strict',
    '--prefix',
    installDir,
    '--registry=https://registry.npmjs.org',
    artifactPath,
  ]);

  const cliPath = path.join(installDir, 'node_modules', '@posidev-community', 'ptai-mcp', 'bin', 'ptai-mcp.js');
  const packageRoot = path.dirname(path.dirname(cliPath));
  const bundled = JSON.parse(fs.readFileSync(path.join(packageRoot, 'dist', 'bundled-dependencies.json'), 'utf8'));
  if (!bundled.some((item) => item.name === '@modelcontextprotocol/sdk'))
    throw new Error('Packed artifact must include its compiled stdio SDK.');
  if (!fs.readFileSync(path.join(packageRoot, 'dist', 'THIRD_PARTY_NOTICES.txt'), 'utf8').includes('Anthropic'))
    throw new Error('Packed SDK license notice is missing.');
  if (fs.existsSync(path.join(installDir, 'node_modules', '@hono', 'node-server')))
    throw new Error('Unused SDK HTTP adapter must not be installed by the artifact.');
  const help = execFileSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
  if (!help.includes('Usage: ptai-mcp')) throw new Error('Packed artifact did not start the CLI successfully.');

  const client = new Client({ name: 'artifact-smoke', version: '1.0' });
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      LOCALAPPDATA: path.join(tempDir, 'localappdata'),
      PTAI_DISABLE_TELEMETRY: 'true',
    }).filter(([, value]) => value !== undefined),
  );
  try {
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [cliPath, 'start'], env, stderr: 'inherit' }),
    );
    const tools = (await client.listTools()).tools;
    if (tools.length !== 33 || tools.filter((tool) => tool.name.startsWith('aie_')).length !== 22)
      throw new Error('Packed MCP tool catalog is incomplete.');
    if ((await client.listResources()).resources.length !== 3 || (await client.listPrompts()).prompts.length !== 1)
      throw new Error('Packed local catalog is incomplete.');
    const context = await client.callTool({ name: 'aie_get_context' });
    if (context.isError) throw new Error('Packed MCP failed to report AIE readiness.');
  } finally {
    await client.close();
  }

  process.stdout.write(`Artifact smoke test passed: ${filename}\n`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
