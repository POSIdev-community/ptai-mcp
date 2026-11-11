import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Platform } from '../utils/platform-constants.js';
import { AGENT_FORMATS, AGENT_IDS, CONFIG_FORMATS, GeminiConfigPath } from './constants.js';
import type { AgentDefinition } from './models.js';

const home = () => os.homedir();
const appData = () => process.env.APPDATA || path.join(home(), 'AppData', 'Roaming');
const codexHome = () => process.env.CODEX_HOME || path.join(home(), '.codex');
const openCodeHome = () =>
  process.env.OPENCODE_CONFIG_DIR ||
  path.join(process.env.XDG_CONFIG_HOME || path.join(home(), '.config'), AGENT_IDS.OPEN_CODE);

const openCodeConfigPaths = () => {
  if (process.env.OPENCODE_CONFIG) {
    return [process.env.OPENCODE_CONFIG];
  }

  const base = openCodeHome();
  const jsoncPath = path.join(base, 'opencode.jsonc');
  const jsonPath = path.join(base, 'opencode.json');

  if (fs.existsSync(jsoncPath)) {
    return [jsoncPath];
  }

  if (fs.existsSync(jsonPath)) {
    return [jsonPath];
  }

  return [jsoncPath];
};

const json = (getMcpConfigPaths: () => string[], getHooksConfigPaths: () => string[] = () => []) => ({
  format: 'json' as const,
  getMcpConfigPaths,
  getHooksConfigPaths,
  supportsHooks: getHooksConfigPaths().length > 0,
});

export const AGENTS: readonly AgentDefinition[] = [
  {
    id: AGENT_IDS.CURSOR,
    displayName: 'Cursor',
    ...json(
      () => [path.join(home(), '.cursor', 'mcp.json')],
      () => [path.join(home(), '.cursor', 'hooks.json')],
    ),
  },
  {
    id: AGENT_IDS.CLAUDE_DESKTOP,
    displayName: 'Claude Desktop',
    ...json(() => {
      if (process.platform === Platform.Windows) {
        return [path.join(appData(), 'Claude', 'claude_desktop_config.json')];
      }

      if (process.platform === Platform.MacOS) {
        return [path.join(home(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')];
      }

      // Linux: XDG
      const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home(), '.config');

      return [path.join(xdgConfig, 'Claude', 'claude_desktop_config.json')];
    }),
  },
  {
    id: AGENT_IDS.CLAUDE_CODE,
    displayName: 'Claude Code',
    ...json(
      () => [path.join(home(), '.claude.json')],
      () => [path.join(home(), '.claude', 'settings.json')],
    ),
  },
  {
    id: AGENT_IDS.WINDSURF,
    displayName: 'Windsurf',
    ...json(
      () => [getWindsurfBasePath('mcp_config.json')],
      () => [getWindsurfBasePath('hooks.json')],
    ),
  },
  {
    id: AGENT_IDS.KIMI_CODE,
    displayName: 'Kimi Code',
    ...json(
      () => [path.join(home(), '.kimi-code', 'mcp.json')],
      () => [path.join(home(), '.kimi-code', 'config.toml')],
    ),
  },
  {
    id: AGENT_IDS.CODEX,
    displayName: 'Codex',
    format: CONFIG_FORMATS.TOML,
    getMcpConfigPaths: () => [path.join(codexHome(), 'config.toml')],
    getHooksConfigPaths: () => [path.join(codexHome(), 'hooks.json')],
    supportsHooks: true,
  },
  {
    id: AGENT_IDS.ANTIGRAVITY,
    displayName: 'Antigravity',
    ...json(
      () => [
        path.join(home(), GeminiConfigPath.Directory, 'config', 'mcp_config.json'),
        path.join(home(), GeminiConfigPath.Directory, AGENT_IDS.ANTIGRAVITY, 'mcp_config.json'),
      ],
      () => [path.join(home(), GeminiConfigPath.Directory, 'config', 'AGENTS.md')],
    ),
  },
  {
    id: AGENT_IDS.GEMINI_CLI,
    displayName: 'Gemini CLI',
    // Gemini CLI stores MCP in ~/.gemini/settings.json under the "mcpServers" key.
    // This is the same JSON format as other agents — standard mcpServers object.
    // All other settings.json keys (general, ui, model, tools, security, etc.) are preserved.
    ...json(
      () => [path.join(home(), GeminiConfigPath.Directory, 'settings.json')],
      // Rules-only hooks via ~/.gemini/GEMINI.md (no separate hooks config file)
    ),
  },
  {
    id: AGENT_IDS.OPEN_CODE,
    displayName: 'OpenCode',
    format: AGENT_FORMATS.OPEN_CODE,
    getMcpConfigPaths: openCodeConfigPaths,
    getHooksConfigPaths: () => [path.join(openCodeHome(), 'plugins', 'pt_ai_security', 'index.ts')],
    supportsHooks: true,
  },
];

export function getAgent(id: string): AgentDefinition | undefined {
  return AGENTS.find((agent) => agent.id === id);
}

export function getSupportedAgents(): AgentDefinition[] {
  return [...AGENTS];
}

export function isAgentDetected(agent: AgentDefinition): boolean {
  // Match the host integrations: an agent is considered installed when its
  // configuration directory exists, even before the agent has created the
  // specific MCP file we manage.
  return agent.getMcpConfigPaths().some((configPath) => {
    if (fs.existsSync(configPath)) {
      return true;
    }

    // A few agents keep their primary config directly in the home directory
    // (for example ~/.claude.json). The home directory itself always exists
    // and must not be treated as evidence that such an agent is installed.
    const parent = path.resolve(path.dirname(configPath));

    if (parent === path.resolve(home())) {
      return false;
    }

    return fs.existsSync(parent);
  });
}

function getWindsurfBasePath(fileName: string): string {
  const homePath = path.join(home(), '.codeium', AGENT_IDS.WINDSURF);

  if (process.platform === Platform.Windows) {
    const appDataPath = path.join(appData(), 'Codeium', AGENT_IDS.WINDSURF);

    if (fs.existsSync(appDataPath) && !fs.existsSync(homePath)) {
      return path.join(appDataPath, fileName);
    }
  }

  return path.join(homePath, fileName);
}
