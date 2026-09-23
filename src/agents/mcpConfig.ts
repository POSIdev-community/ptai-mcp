import fs from 'node:fs/promises';
import path from 'node:path';
import TOML from '@iarna/toml';
import type { AgentDefinition } from './registry.js';

export const MCP_SERVER_NAME = 'ptai_analyzer';
export const MCP_PACKAGE_NAME = '@posidev-community/ptai-mcp';

export interface McpServerConfig {
  command: string;
  args: string[];
  [key: string]: unknown;
}

export interface McpConfigResult {
  changed: boolean;
  paths: string[];
}

export async function configureMcp(agent: AgentDefinition, configPath: string): Promise<McpConfigResult> {
  if (!(await canUseConfigPath(configPath))) {
    return { changed: false, paths: [] };
  }

  if (agent.format === 'toml') {
    return writeTomlMcpConfig(configPath);
  }
  return writeJsonMcpConfig(configPath);
}

export async function removeMcp(agent: AgentDefinition, configPath: string): Promise<boolean> {
  try {
    const source = await readOptional(configPath);
    if (source === null) return false;

    if (agent.format === 'toml') {
      const model = TOML.parse(source) as Record<string, unknown>;
      const servers = asRecord(model.mcp_servers);
      if (!servers || !(MCP_SERVER_NAME in servers)) return false;
      delete servers[MCP_SERVER_NAME];
      await writeText(configPath, TOML.stringify(model as TOML.JsonMap));
      return true;
    }

    const model = JSON.parse(source) as Record<string, unknown>;
    const servers = asRecord(model.mcpServers);
    if (!servers || !(MCP_SERVER_NAME in servers)) return false;
    delete servers[MCP_SERVER_NAME];
    await writeText(configPath, `${JSON.stringify(model, null, 2)}\n`);
    return true;
  } catch (error) {
    throw new Error(`Failed to update MCP config ${configPath}: ${formatError(error)}`, { cause: error });
  }
}

export async function isMcpConfigured(agent: AgentDefinition, configPath: string): Promise<boolean> {
  try {
    const source = await readOptional(configPath);
    if (source === null) return false;

    const model =
      agent.format === 'toml'
        ? (TOML.parse(source) as Record<string, unknown>)
        : (JSON.parse(source) as Record<string, unknown>);
    const servers = asRecord(agent.format === 'toml' ? model.mcp_servers : model.mcpServers);
    const server = servers ? asRecord(servers[MCP_SERVER_NAME]) : undefined;
    if (!server || server.command !== 'npx') return false;
    const args = Array.isArray(server.args) ? server.args : [];
    return args.includes('-y') && args.includes(MCP_PACKAGE_NAME) && args.includes('start');
  } catch {
    return false;
  }
}

function buildServerConfig(): McpServerConfig {
  return {
    command: 'npx',
    args: ['-y', MCP_PACKAGE_NAME, 'start'],
  };
}

async function writeJsonMcpConfig(configPath: string): Promise<McpConfigResult> {
  const source = await readOptional(configPath);
  const model = source === null || source.trim() === '' ? {} : (JSON.parse(source) as Record<string, unknown>);
  const servers = ensureRecord(model, 'mcpServers');
  const previous = asRecord(servers[MCP_SERVER_NAME]);
  const desired = { ...(previous ?? {}), ...buildServerConfig() };
  const changed = JSON.stringify(previous) !== JSON.stringify(desired);
  if (changed) {
    servers[MCP_SERVER_NAME] = desired;
    await writeText(configPath, `${JSON.stringify(model, null, 2)}\n`);
  }
  return { changed, paths: [configPath] };
}

async function writeTomlMcpConfig(configPath: string): Promise<McpConfigResult> {
  const source = await readOptional(configPath);
  const model = source === null || source.trim() === '' ? {} : (TOML.parse(source) as Record<string, unknown>);
  const servers = ensureRecord(model, 'mcp_servers');
  const previous = asRecord(servers[MCP_SERVER_NAME]);
  const desired = { ...(previous ?? {}), ...buildServerConfig() };
  const changed = JSON.stringify(previous) !== JSON.stringify(desired);
  if (changed) {
    servers[MCP_SERVER_NAME] = desired;
    await writeText(configPath, TOML.stringify(model as TOML.JsonMap));
  }
  return { changed, paths: [configPath] };
}

async function canUseConfigPath(configPath: string): Promise<boolean> {
  try {
    await fs.access(configPath);
    return true;
  } catch {
    try {
      await fs.access(path.dirname(configPath));
      return true;
    } catch {
      return false;
    }
  }
}

async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function writeText(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = asRecord(parent[key]);
  if (existing) return existing;
  const created: Record<string, unknown> = {};
  parent[key] = created;
  return created;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
