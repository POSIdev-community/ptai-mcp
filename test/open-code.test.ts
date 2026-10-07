import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentDefinition } from '../src/agents/registry.js';
import {
  configureOpenCodeHooks,
  configureOpenCodeMcp,
  isOpenCodeHooksConfigured,
  isOpenCodeMcpConfigured,
  openCodePlugin,
  removeOpenCodeHooks,
  removeOpenCodeMcp,
} from '../src/agents/openCode.js';
import { parseJsonc } from '../src/utils/jsonc.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('OpenCode integration', () => {
  it('adds and removes the MCP entry without losing JSONC comments or unrelated settings', async () => {
    const root = await temporaryRoot();
    const configPath = path.join(root, 'opencode.jsonc');
    await fs.writeFile(
      configPath,
      `{
  // Keep this model choice.
  "model": "provider/model",
  "mcp": {
    "other": { "type": "remote", "url": "https://example.test" },
  },
}
`,
    );

    const configured = await configureOpenCodeMcp(configPath);
    const source = await fs.readFile(configPath, 'utf8');
    const model = parseJsonc(source);

    expect(configured.changed).toBe(true);
    expect(source).toContain('// Keep this model choice.');
    expect(model.model).toBe('provider/model');
    const mcp = model.mcp as Record<string, unknown>;
    expect(mcp.other).toBeDefined();
    const servers = mcp.servers as Record<string, Record<string, unknown>>;
    expect(servers.ptai_analyzer.disabled).toBe(false);
    expect(servers.ptai_analyzer.enabled).toBeUndefined();
    expect(servers.ptai_analyzer.timeout).toEqual({
      startup: 600000,
      catalog: 600000,
      execution: 600000,
    });
    expect(await isOpenCodeMcpConfigured(configPath)).toBe(true);
    expect((await configureOpenCodeMcp(configPath)).changed).toBe(false);

    expect(await removeOpenCodeMcp(configPath)).toBe(true);
    const removed = parseJsonc(await fs.readFile(configPath, 'utf8'));
    expect((removed.mcp as Record<string, unknown>).other).toBeDefined();
    expect(await isOpenCodeMcpConfigured(configPath)).toBe(false);
  });

  it('migrates the pre-V2 MCP location to mcp.servers', async () => {
    const root = await temporaryRoot();
    const configPath = path.join(root, 'opencode.jsonc');
    await fs.writeFile(
      configPath,
      '{\n  "mcp": {\n    "ptai_analyzer": { "type": "local", "enabled": true },\n  }\n}\n',
    );

    expect(await isOpenCodeMcpConfigured(configPath)).toBe(false);
    await configureOpenCodeMcp(configPath);

    const mcp = parseJsonc(await fs.readFile(configPath, 'utf8')).mcp as Record<string, unknown>;
    expect(mcp.ptai_analyzer).toBeUndefined();
    expect((mcp.servers as Record<string, unknown>).ptai_analyzer).toBeDefined();
    expect(await isOpenCodeMcpConfigured(configPath)).toBe(true);
  });

  it('preserves a comment in an otherwise empty MCP object', async () => {
    const root = await temporaryRoot();
    const configPath = path.join(root, 'opencode.jsonc');
    await fs.writeFile(configPath, '{\n  "mcp": {\n    // local servers\n  }\n}\n');

    await configureOpenCodeMcp(configPath);

    expect(await fs.readFile(configPath, 'utf8')).toContain('// local servers');
  });

  it('manages only the generated OpenCode plugin', async () => {
    const root = await temporaryRoot();
    const pluginPath = path.join(root, 'plugins', 'pt_ai_security', 'index.ts');
    const agent = openCodeAgent(path.join(root, 'opencode.jsonc'), pluginPath);

    expect(await configureOpenCodeHooks(agent, '/bundle/McpProxy')).toBe(true);
    expect(await isOpenCodeHooksConfigured(agent)).toBe(true);
    const plugin = await fs.readFile(pluginPath, 'utf8');
    expect(plugin).toContain('export default {');
    expect(plugin).toContain('ctx.session.hook("chat.message"');
    expect(plugin).toContain('ctx.session.hook("context"');
    expect(plugin).toContain('ctx.event.subscribe');
    expect(plugin).toContain('session.idle');
    expect(plugin).toContain('MAX_IDLE_ATTEMPTS = 2');
    expect(plugin).toContain('exitCode !== 2');
    expect(plugin).toContain('hook-start');
    expect(plugin).toContain('hook');
    expect(plugin).not.toContain('@opencode/plugin');
    expect(plugin).not.toContain('@opencode-ai/plugin');
    expect(plugin).not.toContain('"prompt"');
    expect(await removeOpenCodeHooks(agent)).toBe(true);

    await fs.mkdir(path.dirname(pluginPath), { recursive: true });
    await fs.writeFile(pluginPath, '// user plugin\n');
    expect(await removeOpenCodeHooks(agent)).toBe(false);
    await expect(configureOpenCodeHooks(agent, '/bundle/McpProxy')).rejects.toThrow('Refusing to overwrite');
    expect(await fs.readFile(pluginPath, 'utf8')).toBe('// user plugin\n');
  });

  it('renders the configured proxy path in the plugin safely', () => {
    expect(openCodePlugin('C:\\Program Files\\PTAI\\McpProxy.exe')).toContain(
      'C:\\\\Program Files\\\\PTAI\\\\McpProxy.exe',
    );
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-opencode-'));
  roots.push(root);
  return root;
}

function openCodeAgent(configPath: string, pluginPath: string): AgentDefinition {
  return {
    id: 'opencode',
    displayName: 'OpenCode',
    format: 'opencode',
    getMcpConfigPaths: () => [configPath],
    getHooksConfigPaths: () => [pluginPath],
    supportsHooks: true,
  };
}
