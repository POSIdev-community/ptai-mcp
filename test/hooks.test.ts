import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TOML from '@iarna/toml';
import { configureHooks, isHooksConfigured, removeHooks } from '../src/agents/hooksConfig.js';
import { AGENT_IDS } from '../src/agents/constants.js';

describe('hook configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('configures and detects Cursor hooks without losing user data', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-hooks-'));
    const cursorDir = path.join(root, '.cursor');
    const hooksPath = path.join(cursorDir, 'hooks.json');
    const agent = {
      id: AGENT_IDS.CURSOR,
      displayName: 'Cursor',
      format: 'json' as const,
      getMcpConfigPaths: () => [path.join(cursorDir, 'mcp.json')],
      getHooksConfigPaths: () => [hooksPath],
      supportsHooks: true,
    };
    await fs.mkdir(cursorDir, { recursive: true });
    await fs.writeFile(hooksPath, JSON.stringify({ hooks: { stop: [{ command: 'user-command' }] }, custom: true }));

    // Act
    await configureHooks(agent, path.join(root, 'McpProxy.exe'));

    // Assert
    const configured = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
    expect(configured.custom).toBe(true);
    expect(configured.hooks.stop).toHaveLength(2);
    expect(await isHooksConfigured(agent)).toBe(true);
    expect(await fs.readFile(path.join(cursorDir, 'rules', 'pt_ai_security.mdc'), 'utf8')).toContain(
      'PT AI Security Rules',
    );

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes Cursor hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-hooks-rm-'));
    const cursorDir = path.join(root, '.cursor');
    const hooksPath = path.join(cursorDir, 'hooks.json');
    const agent = {
      id: AGENT_IDS.CURSOR,
      displayName: 'Cursor',
      format: 'json' as const,
      getMcpConfigPaths: () => [path.join(cursorDir, 'mcp.json')],
      getHooksConfigPaths: () => [hooksPath],
      supportsHooks: true,
    };
    await fs.mkdir(cursorDir, { recursive: true });
    await fs.writeFile(hooksPath, JSON.stringify({ hooks: { stop: [{ command: 'user-command' }] }, custom: true }));
    await configureHooks(agent, path.join(root, 'McpProxy.exe')); // setup

    // Act
    await removeHooks(agent);

    // Assert
    const removed = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
    expect(removed.custom).toBe(true);
    expect(removed.hooks.stop).toHaveLength(1);
    await expect(fs.access(path.join(cursorDir, 'rules', 'pt_ai_security.mdc'))).rejects.toThrow();

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('detects and removes Cursor hooks installed through the npm package form', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-hooks-package-'));
    const hooksPath = path.join(root, '.cursor', 'hooks.json');
    const agent = hookAgent(AGENT_IDS.CURSOR, hooksPath, path.join(root, 'mcp.json'));
    await fs.mkdir(path.dirname(hooksPath), { recursive: true });
    await fs.writeFile(
      hooksPath,
      JSON.stringify({
        hooks: {
          stop: [{ command: 'npx -y @posidev-community/ptai-mcp hook --format cursor' }],
          beforeSubmitPrompt: [{ command: 'npx -y @posidev-community/ptai-mcp hook-start --format cursor' }],
        },
      }),
    );

    // Act / Assert
    expect(await isHooksConfigured(agent)).toBe(true);
    expect(await removeHooks(agent)).toBe(true);
    const removed = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
    expect(removed.hooks.stop).toEqual([]);
    expect(removed.hooks.beforeSubmitPrompt).toEqual([]);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('detects and removes Cursor hooks installed with a direct proxy path', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-hooks-direct-'));
    const hooksPath = path.join(root, '.cursor', 'hooks.json');
    const agent = hookAgent(AGENT_IDS.CURSOR, hooksPath, path.join(root, 'mcp.json'));
    const proxyPath = 'C:\\Program Files\\PT AI\\McpProxy.exe';
    await fs.mkdir(path.dirname(hooksPath), { recursive: true });
    await fs.writeFile(
      hooksPath,
      JSON.stringify({
        hooks: {
          stop: [{ command: `"${proxyPath}" hook --format cursor` }],
          beforeSubmitPrompt: [{ command: `"${proxyPath}" hook-start --format cursor` }],
        },
      }),
    );

    // Act / Assert
    expect(await isHooksConfigured(agent)).toBe(true);
    expect(await removeHooks(agent)).toBe(true);
    const removed = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
    expect(removed.hooks.stop).toEqual([]);
    expect(removed.hooks.beforeSubmitPrompt).toEqual([]);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('does not detect or remove hooks from another executable with the same format', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-hooks-unrelated-'));
    const hooksPath = path.join(root, '.cursor', 'hooks.json');
    const agent = hookAgent(AGENT_IDS.CURSOR, hooksPath, path.join(root, 'mcp.json'));
    const otherProxyPath = 'C:\\Program Files\\Other Vendor\\OtherProxy.exe';
    await fs.mkdir(path.dirname(hooksPath), { recursive: true });
    await fs.writeFile(
      hooksPath,
      JSON.stringify({
        hooks: {
          stop: [{ command: `"${otherProxyPath}" hook --format cursor` }],
          beforeSubmitPrompt: [{ command: `"${otherProxyPath}" hook-start --format cursor` }],
        },
      }),
    );

    // Act / Assert
    expect(await isHooksConfigured(agent)).toBe(false);
    expect(await removeHooks(agent)).toBe(false);
    const unchanged = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
    expect(unchanged.hooks.stop).toHaveLength(1);
    expect(unchanged.hooks.beforeSubmitPrompt).toHaveLength(1);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('configures Claude Code hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-claude-hooks-'));
    const settingsPath = path.join(root, 'settings.json');
    const agent = hookAgent(AGENT_IDS.CLAUDE_CODE, settingsPath, path.join(root, 'mcp.json'));

    // Act
    await configureHooks(agent, path.join(root, 'McpProxy.exe'));

    // Assert
    expect(await isHooksConfigured(agent)).toBe(true);
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    expect(JSON.stringify(settings)).toContain('ptai_analyzer');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes Claude Code hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-claude-hooks-rm-'));
    const settingsPath = path.join(root, 'settings.json');
    const agent = hookAgent(AGENT_IDS.CLAUDE_CODE, settingsPath, path.join(root, 'mcp.json'));
    await configureHooks(agent, path.join(root, 'McpProxy.exe'));

    // Act
    await removeHooks(agent);

    // Assert
    expect(await isHooksConfigured(agent)).toBe(false);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('configures Windsurf hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-multi-hooks-'));
    const windsurfDir = path.join(root, '.codeium', 'windsurf');
    const windsurf = hookAgent(
      AGENT_IDS.WINDSURF,
      path.join(windsurfDir, 'hooks.json'),
      path.join(root, 'windsurf-mcp.json'),
    );

    // Act
    await configureHooks(windsurf, path.join(root, 'McpProxy.exe'));

    // Assert
    expect(await isHooksConfigured(windsurf)).toBe(true);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes Windsurf hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-multi-hooks-rm-'));
    const windsurfDir = path.join(root, '.codeium', 'windsurf');
    const windsurf = hookAgent(
      AGENT_IDS.WINDSURF,
      path.join(windsurfDir, 'hooks.json'),
      path.join(root, 'windsurf-mcp.json'),
    );
    await configureHooks(windsurf, path.join(root, 'McpProxy.exe'));

    // Act
    await removeHooks(windsurf);

    // Assert
    expect(await isHooksConfigured(windsurf)).toBe(false);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('configures Kimi Code hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-multi-hooks-'));
    const kimi = hookAgent(
      AGENT_IDS.KIMI_CODE,
      path.join(root, 'kimi', 'config.toml'),
      path.join(root, 'kimi-mcp.json'),
    );

    // Act
    await configureHooks(kimi, path.join(root, 'McpProxy.exe'));

    // Assert
    expect(await isHooksConfigured(kimi)).toBe(true);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes Kimi Code hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-multi-hooks-rm-'));
    const kimi = hookAgent(
      AGENT_IDS.KIMI_CODE,
      path.join(root, 'kimi', 'config.toml'),
      path.join(root, 'kimi-mcp.json'),
    );
    await configureHooks(kimi, path.join(root, 'McpProxy.exe'));

    // Act
    await removeHooks(kimi);

    // Assert
    expect(await isHooksConfigured(kimi)).toBe(false);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('configures Codex hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-multi-hooks-'));
    const codex = hookAgent(
      AGENT_IDS.CODEX,
      path.join(root, 'codex', 'hooks.json'),
      path.join(root, 'codex', 'config.toml'),
    );
    const proxyPath = path.join(root, 'McpProxy.exe');

    // Act
    await configureHooks(codex, proxyPath);

    // Assert
    expect(await isHooksConfigured(codex, proxyPath)).toBe(true);
    expect(await fs.readFile(codex.getMcpConfigPaths()[0], 'utf8')).toContain('trusted_hash');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes Codex hooks', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-multi-hooks-rm-'));
    const codex = hookAgent(
      AGENT_IDS.CODEX,
      path.join(root, 'codex', 'hooks.json'),
      path.join(root, 'codex', 'config.toml'),
    );
    const proxyPath = path.join(root, 'McpProxy.exe');
    await configureHooks(codex, proxyPath);
    const configPath = codex.getMcpConfigPaths()[0];
    const config = TOML.parse(await fs.readFile(configPath, 'utf8')) as Record<string, unknown>;
    const hooks = config.hooks as Record<string, unknown>;
    const state = hooks.state as Record<string, unknown>;
    const unrelatedKey = `${path.join(root, 'other', 'hooks.json')}:Stop:0:0`;
    state[unrelatedKey] = { trusted_hash: 'unrelated' };
    await fs.writeFile(configPath, TOML.stringify(config as TOML.JsonMap));

    // Act
    await removeHooks(codex);

    // Assert
    expect(await isHooksConfigured(codex, proxyPath)).toBe(false);
    const remaining = TOML.parse(await fs.readFile(configPath, 'utf8')) as Record<string, unknown>;
    expect((remaining.hooks as Record<string, unknown>).state).toHaveProperty(unrelatedKey);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('does not report Codex hooks as configured without trusted state', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-codex-trust-'));
    const codex = hookAgent(
      AGENT_IDS.CODEX,
      path.join(root, 'codex', 'hooks.json'),
      path.join(root, 'codex', 'config.toml'),
    );
    const proxyPath = path.join(root, 'McpProxy.exe');
    await configureHooks(codex, proxyPath);
    const configPath = codex.getMcpConfigPaths()[0];
    const content = await fs.readFile(configPath, 'utf8');
    await fs.writeFile(configPath, content.replace(/trusted_hash\s*=\s*"[^"]+"/g, 'trusted_hash = "invalid"'));
    expect(await isHooksConfigured(codex, proxyPath)).toBe(false);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('Codex trust state includes enabled: true and uses snake_case event keys', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-codex-trust-detail-'));
    const hooksPath = path.join(root, 'codex', 'hooks.json');
    const configPath = path.join(root, 'codex', 'config.toml');
    const codex = hookAgent(AGENT_IDS.CODEX, hooksPath, configPath);
    const proxyPath = path.join(root, 'McpProxy.exe');

    // Act
    await configureHooks(codex, proxyPath);

    // Assert — parse config.toml
    const config = TOML.parse(await fs.readFile(configPath, 'utf8')) as Record<string, unknown>;
    const hooks = config.hooks as Record<string, unknown>;
    const state = hooks.state as Record<string, unknown>;

    // Verify state keys use snake_case event names (matching Codex CLI internal normalization)
    const resolvedHooksPath = path.resolve(hooksPath);
    const stopKey = `${resolvedHooksPath}:stop:0:0`;
    const startKey = `${resolvedHooksPath}:user_prompt_submit:0:0`;
    expect(state).toHaveProperty(stopKey);
    expect(state).toHaveProperty(startKey);

    // Verify both entries have 'enabled: true' (required by Codex CLI)
    const stopEntry = state[stopKey] as Record<string, unknown>;
    const startEntry = state[startKey] as Record<string, unknown>;
    expect(stopEntry.enabled).toBe(true);
    expect(startEntry.enabled).toBe(true);

    // Verify hashes are sha256 format
    expect(stopEntry.trusted_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(startEntry.trusted_hash).toMatch(/^sha256:[0-9a-f]{64}$/);

    // Verify hashes are different (stop is mcp_tool, start is command)
    expect(stopEntry.trusted_hash).not.toBe(startEntry.trusted_hash);

    // Verify features.hooks is enabled
    expect((config.features as Record<string, unknown>).hooks).toBe(true);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('Codex trust hashes are deterministic across repeated configurations', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-codex-hash-det-'));
    const hooksPath = path.join(root, 'codex', 'hooks.json');
    const configPath = path.join(root, 'codex', 'config.toml');
    const codex = hookAgent(AGENT_IDS.CODEX, hooksPath, configPath);
    const proxyPath = path.join(root, 'McpProxy.exe');

    // Configure twice
    await configureHooks(codex, proxyPath);
    const config1 = await fs.readFile(configPath, 'utf8');
    await configureHooks(codex, proxyPath);
    const config2 = await fs.readFile(configPath, 'utf8');

    // Hashes must be identical
    expect(config2).toBe(config1);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('Codex hooks.json includes commandWindows field for start hook', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-codex-cmdwin-'));
    const hooksPath = path.join(root, 'codex', 'hooks.json');
    const codex = hookAgent(AGENT_IDS.CODEX, hooksPath, path.join(root, 'codex', 'config.toml'));
    const proxyPath = path.join(root, 'McpProxy.exe');

    await configureHooks(codex, proxyPath);
    const hooks = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
    const startHooks = hooks.hooks.UserPromptSubmit;
    expect(startHooks).toBeDefined();
    const startInner = startHooks[0].hooks[0];
    expect(startInner.type).toBe('command');
    // Must use camelCase 'commandWindows' (not snake_case 'command_windows')
    expect(startInner).toHaveProperty('commandWindows');
    expect(startInner).not.toHaveProperty('command_windows');
    expect(startInner.commandWindows).toContain('hook-start --format codex');

    await fs.rm(root, { recursive: true, force: true });
  });

  it('Kimi hooks include timeout: 600', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-kimi-timeout-'));
    const kimi = hookAgent(
      AGENT_IDS.KIMI_CODE,
      path.join(root, 'kimi', 'config.toml'),
      path.join(root, 'kimi-mcp.json'),
    );
    await configureHooks(kimi, path.join(root, 'McpProxy.exe'));
    const config = TOML.parse(await fs.readFile(path.join(root, 'kimi', 'config.toml'), 'utf8'));
    const hooks = config.hooks as Record<string, unknown>[];
    for (const hook of hooks) {
      expect(hook.timeout).toBe(600);
    }
    await fs.rm(root, { recursive: true, force: true });
  });

  it('keeps repeated configuration idempotent for every JSON/TOML hook format', async () => {
    for (const id of [
      AGENT_IDS.CURSOR,
      AGENT_IDS.CLAUDE_CODE,
      AGENT_IDS.WINDSURF,
      AGENT_IDS.KIMI_CODE,
      AGENT_IDS.CODEX,
    ]) {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), `ptai-mcp-idempotent-${id}-`));
      const hooksPath = path.join(root, 'hooks', id === AGENT_IDS.KIMI_CODE ? 'config.toml' : 'hooks.json');
      const mcpPath = path.join(root, 'mcp.json');
      const agent = hookAgent(id, hooksPath, mcpPath);
      const proxyPath = path.join(root, 'McpProxy.exe');
      await configureHooks(agent, proxyPath);
      const first = await fs.readFile(hooksPath, 'utf8');
      await configureHooks(agent, proxyPath);
      expect(await fs.readFile(hooksPath, 'utf8')).toBe(first);
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('configures Antigravity rules and workflow using GEMINI.md', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-antigravity-'));
    vi.stubEnv('USERPROFILE', root);
    const agent = hookAgent(AGENT_IDS.ANTIGRAVITY, path.join(root, 'GEMINI.md'), path.join(root, 'mcp.json'));

    // Act
    await configureHooks(agent, path.join(root, 'McpProxy.exe'));

    // Assert
    expect(await isHooksConfigured(agent)).toBe(true);
    expect(
      await fs.readFile(path.join(root, '.gemini', 'config', 'global_workflows', 'pt_ai_security_scan.md'), 'utf8'),
    ).toContain('PT AI Security Scan');
    // Verify rules are written to GEMINI.md
    expect(await fs.readFile(path.join(root, '.gemini', 'GEMINI.md'), 'utf8')).toContain('PT AI Security Rules');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes Antigravity rules and workflow', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-antigravity-rm-'));
    vi.stubEnv('USERPROFILE', root);
    const agent = hookAgent(AGENT_IDS.ANTIGRAVITY, path.join(root, 'GEMINI.md'), path.join(root, 'mcp.json'));
    await configureHooks(agent, path.join(root, 'McpProxy.exe'));

    // Act
    await removeHooks(agent);

    // Assert
    expect(await isHooksConfigured(agent)).toBe(false);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('configures Gemini CLI rules via GEMINI.md', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-gemini-cli-hooks-'));
    vi.stubEnv('USERPROFILE', root);
    const agent = hookAgent(AGENT_IDS.GEMINI_CLI, path.join(root, 'settings.json'), path.join(root, 'settings.json'));

    // Act
    await configureHooks(agent, path.join(root, 'McpProxy.exe'));

    // Assert
    expect(await isHooksConfigured(agent)).toBe(true);
    expect(await fs.readFile(path.join(root, '.gemini', 'GEMINI.md'), 'utf8')).toContain('PT AI Security Rules');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes Gemini CLI rules', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-gemini-cli-hooks-rm-'));
    vi.stubEnv('USERPROFILE', root);
    const agent = hookAgent(AGENT_IDS.GEMINI_CLI, path.join(root, 'settings.json'), path.join(root, 'settings.json'));
    await configureHooks(agent, path.join(root, 'McpProxy.exe'));

    // Act
    await removeHooks(agent);

    // Assert
    expect(await isHooksConfigured(agent)).toBe(false);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('Antigravity and Gemini CLI can coexist in the same GEMINI.md', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-shared-gemini-'));
    vi.stubEnv('USERPROFILE', root);
    const antigravity = hookAgent(AGENT_IDS.ANTIGRAVITY, path.join(root, 'ag.md'), path.join(root, 'mcp1.json'));
    const geminiCli = hookAgent(AGENT_IDS.GEMINI_CLI, path.join(root, 'gc.json'), path.join(root, 'mcp2.json'));

    // Act — configure both
    await configureHooks(antigravity, path.join(root, 'McpProxy.exe'));
    await configureHooks(geminiCli, path.join(root, 'McpProxy.exe'));

    // Assert — both configured, rules not duplicated
    expect(await isHooksConfigured(antigravity)).toBe(true);
    expect(await isHooksConfigured(geminiCli)).toBe(true);
    const geminiMd = await fs.readFile(path.join(root, '.gemini', 'GEMINI.md'), 'utf8');
    // RULES_START and RULES_END both contain 'PT AI Security Rules', so one copy has 2 occurrences.
    // Verify the section start marker appears exactly once (not duplicated).
    const markerOccurrences = geminiMd.split('<!-- PT AI Security Rules - DO NOT EDIT -->').length - 1;
    expect(markerOccurrences).toBe(1); // idempotent — only one copy

    // Act — remove Gemini CLI, Antigravity should still see its rules removed too
    // (they share the same file, removeRules removes the section)
    await removeHooks(geminiCli);
    expect(await isHooksConfigured(geminiCli)).toBe(false);
    expect(await isHooksConfigured(antigravity)).toBe(false); // same file

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });
});

function hookAgent(id: string, hooksPath: string, mcpPath: string) {
  return {
    id,
    displayName: id,
    format: id === AGENT_IDS.CODEX ? ('toml' as const) : ('json' as const),
    getMcpConfigPaths: () => [mcpPath],
    getHooksConfigPaths: () => [hooksPath],
    supportsHooks: true,
  };
}
