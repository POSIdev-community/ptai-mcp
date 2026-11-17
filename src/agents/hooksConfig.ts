import { getProxyPath } from '../utils/paths.js';
import { AGENT_FORMATS, AGENT_IDS, HOOK_EVENTS } from './constants.js';
import { configureCodexHooks, hasCodexHooks, removeCodexHooks } from './hooks/codex-hooks.js';
import {
  configureAntigravityHooks,
  configureGeminiCliHooks,
  hasGeminiRules,
  removeAntigravityHooks,
  removeGeminiCliHooks,
} from './hooks/gemini-hooks.js';
import {
  configureClaudeCodeHooks,
  configureCursorHooks,
  configureWindsurfHooks,
  hasClaudeCodeHooks,
  hasJsonHooks,
  removeClaudeCodeHooks,
  removeJsonHooks,
} from './hooks/json-hooks.js';
import { configureKimiHooks, hasKimiHooks, removeKimiHooks } from './hooks/kimi-hooks.js';
import { type AgentDefinition } from './models.js';
import { configureOpenCodeHooks, isOpenCodeHooksConfigured, removeOpenCodeHooks } from './openCode.js';

const HOOK_ADAPTERS: Readonly<Record<string, HookAdapter>> = {
  [AGENT_IDS.CURSOR]: {
    configure: configureCursorHooks,
    isConfigured: (agent) =>
      hasJsonHooks(
        agent.getHooksConfigPaths()[0],
        HOOK_EVENTS.CURSOR_STOP,
        HOOK_EVENTS.CURSOR_START,
        AGENT_FORMATS.CURSOR,
      ),
    remove: (agent) =>
      removeJsonHooks(
        agent.getHooksConfigPaths()[0],
        [HOOK_EVENTS.CURSOR_STOP, HOOK_EVENTS.CURSOR_START],
        [`hook --format ${AGENT_FORMATS.CURSOR}`, `hook-start --format ${AGENT_FORMATS.CURSOR}`],
      ),
  },
  [AGENT_IDS.CLAUDE_CODE]: {
    configure: configureClaudeCodeHooks,
    isConfigured: (agent) => hasClaudeCodeHooks(agent.getHooksConfigPaths()[0]),
    remove: (agent) => removeClaudeCodeHooks(agent.getHooksConfigPaths()[0]),
  },
  [AGENT_IDS.WINDSURF]: {
    configure: configureWindsurfHooks,
    isConfigured: (agent) =>
      hasJsonHooks(
        agent.getHooksConfigPaths()[0],
        HOOK_EVENTS.WINDSURF_STOP,
        HOOK_EVENTS.WINDSURF_START,
        AGENT_FORMATS.WINDSURF,
      ),
    remove: (agent) =>
      removeJsonHooks(
        agent.getHooksConfigPaths()[0],
        [HOOK_EVENTS.WINDSURF_STOP, HOOK_EVENTS.WINDSURF_START],
        [`hook --format ${AGENT_FORMATS.WINDSURF}`, `hook-start --format ${AGENT_FORMATS.WINDSURF}`],
      ),
  },
  [AGENT_IDS.KIMI_CODE]: {
    configure: configureKimiHooks,
    isConfigured: (agent) => hasKimiHooks(agent.getHooksConfigPaths()[0]),
    remove: (agent) => removeKimiHooks(agent.getHooksConfigPaths()[0]),
  },
  [AGENT_IDS.CODEX]: {
    configure: configureCodexHooks,
    isConfigured: (agent, proxyPath) =>
      hasCodexHooks(agent.getHooksConfigPaths()[0], agent.getMcpConfigPaths()[0], proxyPath),
    remove: removeCodexHooks,
  },
  [AGENT_IDS.ANTIGRAVITY]: {
    configure: configureAntigravityHooks,
    isConfigured: () => hasGeminiRules(),
    remove: removeAntigravityHooks,
  },
  [AGENT_IDS.GEMINI_CLI]: {
    configure: configureGeminiCliHooks,
    isConfigured: () => hasGeminiRules(),
    remove: removeGeminiCliHooks,
  },
  [AGENT_IDS.OPEN_CODE]: {
    configure: configureOpenCodeHooks,
    isConfigured: (agent) => isOpenCodeHooksConfigured(agent),
    remove: removeOpenCodeHooks,
  },
};

export async function configureHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
  return (HOOK_ADAPTERS[agent.id]?.configure ?? unsupportedConfigure)(agent, proxyPath);
}

export async function isHooksConfigured(agent: AgentDefinition, proxyPath = getProxyPath()): Promise<boolean> {
  try {
    return (await HOOK_ADAPTERS[agent.id]?.isConfigured?.(agent, proxyPath)) ?? false;
  } catch {
    return false;
  }
}

export async function removeHooks(agent: AgentDefinition): Promise<boolean> {
  return (HOOK_ADAPTERS[agent.id]?.remove ?? unsupportedRemove)(agent);
}

async function unsupportedConfigure(): Promise<boolean> {
  return false;
}

async function unsupportedRemove(): Promise<boolean> {
  return false;
}

type HookAdapter = {
  configure: (agent: AgentDefinition, proxyPath: string) => Promise<boolean>;
  isConfigured: (agent: AgentDefinition, proxyPath: string) => Promise<boolean>;
  remove: (agent: AgentDefinition) => Promise<boolean>;
};
