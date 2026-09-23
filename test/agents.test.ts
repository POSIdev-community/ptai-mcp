import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureMcp,
  isMcpConfigured,
  removeMcp,
  MCP_PACKAGE_NAME,
  MCP_SERVER_NAME,
} from '../src/agents/mcpConfig.js';
import { AGENTS, getAgent, getSupportedAgents, isAgentDetected } from '../src/agents/registry.js';
import { AGENT_IDS } from '../src/agents/constants.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('agent registry', () => {
  it('contains all planned agents', () => {
    // Arrange & Act & Assert
    expect(AGENTS.map((agent) => agent.id)).toEqual([
      AGENT_IDS.CURSOR,
      AGENT_IDS.CLAUDE_DESKTOP,
      AGENT_IDS.CLAUDE_CODE,
      AGENT_IDS.WINDSURF,
      AGENT_IDS.KIMI_CODE,
      AGENT_IDS.CODEX,
      AGENT_IDS.ANTIGRAVITY,
      AGENT_IDS.GEMINI_CLI,
    ]);
    expect(AGENTS.find((agent) => agent.id === AGENT_IDS.CODEX)?.format).toBe('toml');
    expect(getAgent(AGENT_IDS.CURSOR)).toBe(AGENTS[0]);
    expect(getAgent('missing')).toBeUndefined();
  });

  it('uses the legacy Windsurf AppData location when needed', () => {
    // Arrange
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    const exists = vi
      .spyOn(syncFs, 'existsSync')
      .mockImplementation((candidate) => String(candidate).includes('AppData'));
    vi.stubEnv('APPDATA', 'C:/Users/test/AppData/Roaming');

    // Act
    const windsurf = AGENTS.find((agent) => agent.id === AGENT_IDS.WINDSURF)!;

    // Assert
    expect(windsurf.getMcpConfigPaths()[0]).toContain('AppData');

    // Cleanup
    exists.mockRestore();
    platform.mockRestore();
    vi.unstubAllEnvs();
  });

  it('detects existing config files', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-detect-'));
    const configPath = path.join(root, 'mcp.json');
    const agent = { ...AGENTS[0], getMcpConfigPaths: () => [configPath] };

    // Act & Assert
    expect(isAgentDetected(agent)).toBe(false);

    // Arrange
    await fs.writeFile(configPath, '{}');

    // Act & Assert
    expect(isAgentDetected(agent)).toBe(true);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('returns all agents on all platforms including Linux', () => {
    // getSupportedAgents no longer filters by platform
    expect(getSupportedAgents().length).toBe(AGENTS.length);
  });

  it('includes Gemini CLI agent pointing to settings.json', () => {
    const agent = getAgent(AGENT_IDS.GEMINI_CLI);
    expect(agent).toBeDefined();
    expect(agent!.displayName).toBe('Gemini CLI');
    expect(agent!.format).toBe('json');
    expect(agent!.getMcpConfigPaths()[0]).toContain(path.join('.gemini', 'settings.json'));
  });

  it('Claude Desktop uses XDG_CONFIG_HOME on Linux', () => {
    // Arrange
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.stubEnv('XDG_CONFIG_HOME', '/custom/config');

    // Act
    const agent = getAgent(AGENT_IDS.CLAUDE_DESKTOP)!;
    const paths = agent.getMcpConfigPaths();

    // Assert
    expect(paths[0]).toBe(path.join('/custom/config', 'Claude', 'claude_desktop_config.json'));

    // Cleanup
    platform.mockRestore();
    vi.unstubAllEnvs();
  });

  it('Claude Desktop falls back to ~/.config on Linux without XDG_CONFIG_HOME', () => {
    // Arrange
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.stubEnv('XDG_CONFIG_HOME', '');

    // Act
    const agent = getAgent(AGENT_IDS.CLAUDE_DESKTOP)!;
    const paths = agent.getMcpConfigPaths();

    // Assert
    expect(paths[0]).toContain(path.join('.config', 'Claude', 'claude_desktop_config.json'));

    // Cleanup
    platform.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe('MCP config writers', () => {
  it('preserves custom JSON server options on first configure', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-json-'));
    const configPath = path.join(root, 'mcp.json');
    const agent = AGENTS.find((candidate) => candidate.id === AGENT_IDS.CURSOR)!;
    await fs.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          [MCP_SERVER_NAME]: { command: 'old', args: [], tools: ['trigger_scan'], custom: true },
        },
        unrelated: { enabled: true },
      }),
    );

    // Act
    const configureResult = await configureMcp(agent, configPath);

    // Assert
    expect(configureResult.changed).toBe(true);
    expect(await isMcpConfigured(agent, configPath)).toBe(true);
    const content = await fs.readFile(configPath, 'utf8');
    expect(JSON.parse(content).mcpServers[MCP_SERVER_NAME].custom).toBe(true);
    expect(JSON.parse(content).unrelated.enabled).toBe(true);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('is idempotent when configured multiple times', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-json-idem-'));
    const configPath = path.join(root, 'mcp.json');
    const agent = AGENTS.find((candidate) => candidate.id === AGENT_IDS.CURSOR)!;
    await fs.writeFile(configPath, JSON.stringify({ mcpServers: {} }));
    await configureMcp(agent, configPath); // first configure

    // Act
    const configureResultIdempotent = await configureMcp(agent, configPath);

    // Assert
    expect(configureResultIdempotent.changed).toBe(false);
    expect(await isMcpConfigured(agent, configPath)).toBe(true);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes the MCP configuration cleanly', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-json-rm-'));
    const configPath = path.join(root, 'mcp.json');
    const agent = AGENTS.find((candidate) => candidate.id === AGENT_IDS.CURSOR)!;
    await fs.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          [MCP_SERVER_NAME]: { command: 'test', args: [] },
        },
      }),
    );

    // Act
    const removeResult = await removeMcp(agent, configPath);

    // Assert
    expect(removeResult).toBe(true);
    const content = await fs.readFile(configPath, 'utf8');
    expect(JSON.parse(content).mcpServers[MCP_SERVER_NAME]).toBeUndefined();

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes the standalone npx format to TOML', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-toml-'));
    const configPath = path.join(root, 'config.toml');
    const agent = AGENTS.find((candidate) => candidate.id === AGENT_IDS.CODEX)!;
    await fs.writeFile(configPath, '[settings]\nmode = "safe"\n');

    // Act
    await configureMcp(agent, configPath);

    // Assert
    const content = await fs.readFile(configPath, 'utf8');
    expect(content).toContain(`[mcp_servers.${MCP_SERVER_NAME}]`);
    expect(content).toContain(`"${MCP_PACKAGE_NAME}"`);
    expect(await isMcpConfigured(agent, configPath)).toBe(true);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('configures Gemini CLI via settings.json preserving existing keys', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-gemini-cli-'));
    const configPath = path.join(root, 'settings.json');
    const agent = getAgent(AGENT_IDS.GEMINI_CLI)!;
    await fs.writeFile(
      configPath,
      JSON.stringify({
        general: { preferredEditor: 'cursor', vimMode: false },
        ui: { hideBanner: true },
        model: { name: 'gemini-3.5-flash' },
        mcpServers: {
          other_server: { command: 'node', args: ['server.js'] },
        },
        hooksConfig: { enabled: true },
      }),
    );

    // Act
    const configureResult = await configureMcp(agent, configPath);

    // Assert
    expect(configureResult.changed).toBe(true);
    expect(await isMcpConfigured(agent, configPath)).toBe(true);
    const content = JSON.parse(await fs.readFile(configPath, 'utf8'));
    // Our server was added
    expect(content.mcpServers[MCP_SERVER_NAME]).toBeDefined();
    // Existing server preserved
    expect(content.mcpServers.other_server).toBeDefined();
    // All other settings preserved
    expect(content.general.preferredEditor).toBe('cursor');
    expect(content.ui.hideBanner).toBe(true);
    expect(content.model.name).toBe('gemini-3.5-flash');
    expect(content.hooksConfig.enabled).toBe(true);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('does not create configs for an agent path whose parent is absent and handles invalid content', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-invalid-config-'));
    const configPath = path.join(root, 'missing', 'mcp.json');
    const agent = AGENTS.find((candidate) => candidate.id === AGENT_IDS.CURSOR)!;

    // Act
    const configureResult = await configureMcp(agent, configPath);

    // Assert
    expect(configureResult.paths).toEqual([]);
    expect(await isMcpConfigured(agent, configPath)).toBe(false);

    // Arrange
    const invalidPath = path.join(root, 'invalid.json');
    await fs.writeFile(invalidPath, '{bad');

    // Act & Assert
    expect(await isMcpConfigured(agent, invalidPath)).toBe(false);
    await expect(removeMcp(agent, invalidPath)).rejects.toThrow('Failed to update MCP config');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });
});
