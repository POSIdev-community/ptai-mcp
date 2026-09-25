import { isCancel, multiselect, select } from '@clack/prompts';
import { logger as log } from '../utils/logger.js';
import { configureHooks, isHooksConfigured, removeHooks } from '../agents/hooksConfig.js';
import { configureMcp, isMcpConfigured, removeMcp } from '../agents/mcpConfig.js';
import { getSupportedAgents, type AgentDefinition, isAgentDetected } from '../agents/registry.js';
import { getProxyPath } from '../utils/paths.js';

export const BACK_TO_MCP_SELECTION = '__back_to_mcp_selection__';
const CONFIGURE_HOOKS = '__configure_hooks__';

export async function configureCommand(): Promise<void> {
  const supportedAgents = getSupportedAgents();
  if (supportedAgents.length === 0) {
    throw new Error(`Unsupported OS: ${process.platform}`);
  }
  const agents = supportedAgents.filter(isAgentDetected);
  if (agents.length === 0) {
    log.info('No supported AI agents were detected on this computer.');
    return;
  }

  while (true) {
    const initiallyConfiguredMcp = await getInitiallyConfiguredMcp(agents);
    const mcpSelection = await multiselect({
      message: 'Select agents for MCP configuration:',
      options: agents.map((agent) => ({
        value: agent.id,
        label: agent.displayName,
        hint: formatPaths(agent.getMcpConfigPaths(), isAgentDetected(agent)),
      })),
      initialValues: initiallyConfiguredMcp,
      required: false,
    });
    if (isCancel(mcpSelection)) {
      log.info('Configuration cancelled.');
      return;
    }

    const selectedMcp = new Set(mcpSelection as string[]);
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

    const hookAgents = agents.filter((agent) => agent.supportsHooks && selectedMcp.has(agent.id));
    let hookSelection: readonly string[] = [];
    if (hookAgents.length > 0) {
      // Keep navigation separate from the agent multiselect. A navigation
      // item inside a multiselect can be selected together with agents,
      // which makes the resulting action ambiguous.
      const action = await select({
        message: 'Hooks configuration:',
        options: [
          {
            value: CONFIGURE_HOOKS,
            label: 'Configure hooks',
          },
          { value: BACK_TO_MCP_SELECTION, label: '← Back to MCP selection' },
        ],
      });
      if (isCancel(action)) {
        log.info('MCP configuration completed; hooks configuration cancelled.');
        return;
      }
      if (action === BACK_TO_MCP_SELECTION) continue;

      const initiallyConfiguredHooks = await getInitiallyConfiguredHooks(hookAgents);
      const selection = await multiselect({
        message: 'Select agents for hooks configuration:',
        options: hookAgents.map((agent) => ({
          value: agent.id,
          label: agent.displayName,
          hint: formatPaths(agent.getHooksConfigPaths(), 'MCP selected'),
        })),
        initialValues: initiallyConfiguredHooks,
        required: false,
      });
      if (isCancel(selection)) {
        log.info('MCP configuration completed; hooks configuration cancelled.');
        return;
      }
      hookSelection = selection as string[];
    }

    const selectedHooks = new Set(hookSelection);
    const proxyPath = getProxyPath();
    for (const agent of agents.filter((candidate) => candidate.supportsHooks)) {
      if (selectedHooks.has(agent.id) && selectedMcp.has(agent.id)) {
        await configureHooks(agent, proxyPath);
        log.success(`Hooks configured for ${agent.displayName}`);
      } else {
        await removeHooksIfPresent(agent);
      }
    }

    log.success('Agent configuration completed.');
    return;
  }
}

async function getInitiallyConfiguredMcp(agents: AgentDefinition[]): Promise<string[]> {
  const configured: string[] = [];
  for (const agent of agents) {
    try {
      const isConfigured = (
        await Promise.all(agent.getMcpConfigPaths().map((configPath) => isMcpConfigured(agent, configPath)))
      ).some(Boolean);
      if (isConfigured) configured.push(agent.id);
    } catch (error) {
      log.warn(`Could not inspect MCP configuration for ${agent.displayName}: ${formatError(error)}`);
    }
  }
  return configured;
}

async function getInitiallyConfiguredHooks(agents: AgentDefinition[]): Promise<string[]> {
  const configured: string[] = [];
  for (const agent of agents) {
    try {
      if (await isHooksConfigured(agent)) configured.push(agent.id);
    } catch (error) {
      log.warn(`Could not inspect hooks configuration for ${agent.displayName}: ${formatError(error)}`);
    }
  }
  return configured;
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
