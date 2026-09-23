import { isCancel, multiselect } from '@clack/prompts';
import { logger as log } from '../utils/logger.js';
import { configureHooks, isHooksConfigured, removeHooks } from '../agents/hooksConfig.js';
import { configureMcp, isMcpConfigured, removeMcp } from '../agents/mcpConfig.js';
import { getSupportedAgents, type AgentDefinition, isAgentDetected } from '../agents/registry.js';
import { getProxyPath } from '../utils/paths.js';

export async function configureCommand(): Promise<void> {
  const agents = getSupportedAgents();
  if (agents.length === 0) {
    throw new Error(`Unsupported OS: ${process.platform}`);
  }

  const mcpSelection = await multiselect({
    message: 'Select agents for MCP configuration:',
    options: agents.map((agent) => ({
      value: agent.id,
      label: agent.displayName,
      hint: formatPaths(agent.getMcpConfigPaths(), isAgentDetected(agent)),
    })),
    required: false,
  });
  if (isCancel(mcpSelection)) {
    log.info('Configuration cancelled.');
    return;
  }

  const selectedMcp = new Set(mcpSelection);
  for (const agent of agents) {
    const selected = selectedMcp.has(agent.id);
    for (const configPath of agent.getMcpConfigPaths()) {
      if (selected) {
        const result = await configureMcp(agent, configPath);
        if (result.paths.length > 0) log.success(`MCP configured for ${agent.displayName}: ${configPath}`);
      } else {
        await removeMcpIfPresent(agent, configPath);
      }
    }
  }

  const hookAgents = agents.filter((agent) => agent.supportsHooks);
  const hookSelection = await multiselect({
    message: 'Select agents for hooks configuration:',
    options: hookAgents.map((agent) => ({
      value: agent.id,
      label: agent.displayName,
      hint: formatPaths(agent.getHooksConfigPaths(), selectedMcp.has(agent.id) ? 'MCP selected' : 'MCP not selected'),
    })),
    required: false,
  });
  if (isCancel(hookSelection)) {
    log.info('MCP configuration completed; hooks configuration cancelled.');
    return;
  }

  const selectedHooks = new Set(hookSelection);
  const proxyPath = getProxyPath();
  for (const agent of hookAgents) {
    if (selectedHooks.has(agent.id) && selectedMcp.has(agent.id)) {
      await configureHooks(agent, proxyPath);
      log.success(`Hooks configured for ${agent.displayName}`);
    } else {
      await removeHooksIfPresent(agent);
    }
  }

  log.success('Agent configuration completed.');
}

export async function getConfigurationStatus(): Promise<
  Array<{
    agent: AgentDefinition;
    mcp: boolean;
    hooks: boolean;
  }>
> {
  const result = [];
  for (const agent of getSupportedAgents()) {
    const mcp = (
      await Promise.all(agent.getMcpConfigPaths().map((configPath) => isMcpConfigured(agent, configPath)))
    ).some(Boolean);
    const hooks = agent.supportsHooks && (await isHooksConfigured(agent));
    result.push({ agent, mcp, hooks });
  }
  return result;
}

async function removeMcpIfPresent(agent: AgentDefinition, configPath: string): Promise<void> {
  try {
    if (await isMcpConfigured(agent, configPath)) {
      await removeMcp(agent, configPath);
      log.info(`MCP removed for ${agent.displayName}: ${configPath}`);
    }
  } catch (error) {
    log.warn(`Could not update ${configPath}: ${formatError(error)}`);
  }
}

async function removeHooksIfPresent(agent: AgentDefinition): Promise<void> {
  try {
    if (await isHooksConfigured(agent)) {
      await removeHooks(agent);
      log.info(`Hooks removed for ${agent.displayName}`);
    }
  } catch (error) {
    log.warn(`Could not remove hooks for ${agent.displayName}: ${formatError(error)}`);
  }
}

function formatPaths(paths: string[], suffix: string | boolean): string {
  const pathText = paths.join(', ');
  return `${pathText} (${typeof suffix === 'boolean' ? (suffix ? 'detected' : 'not detected') : suffix})`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
