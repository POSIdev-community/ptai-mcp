import crypto from 'node:crypto';
import path from 'node:path';
import { LocalToolName } from '../../local/tool-names.js';
import { MCP_SERVER_NAME } from '../../mcp/constants.js';
import { Platform } from '../../utils/platform-constants.js';
import { AGENT_FORMATS, HOOK_EVENTS } from '../constants.js';
import { type AgentDefinition } from '../models.js';
import { hookCommand, hookInput, windowsHookCommand } from './commands.js';
import {
  asRecord,
  ensureArray,
  ensureRecord,
  readJson,
  readJsonOptional,
  readToml,
  readTomlOptional,
  writeJson,
  writeToml,
} from './config-file.js';
import { hasMatching, hasNestedMcp, removeCommandEntries, removeMcpToolEntries } from './hook-entries.js';
import { removeClaudeCodeHooks } from './json-hooks.js';

export async function configureCodexHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
  const hooksPath = agent.getHooksConfigPaths()[0];
  const model = await readJson(hooksPath);
  const hooks = ensureRecord(model, 'hooks');
  const stop = ensureArray(hooks, HOOK_EVENTS.CODEX_STOP);
  const start = ensureArray(hooks, HOOK_EVENTS.CODEX_START);
  removeMcpToolEntries(stop, MCP_SERVER_NAME, LocalToolName.TriggerScan);
  removeCommandEntries(start, `hook-start --format ${AGENT_FORMATS.CODEX}`);
  stop.push({
    matcher: '.*',
    hooks: [
      {
        type: 'mcp_tool',
        server: MCP_SERVER_NAME,
        tool: LocalToolName.TriggerScan,
        input: hookInput(AGENT_FORMATS.CODEX),
      },
    ],
  });
  const command = hookCommand(proxyPath, AGENT_FORMATS.CODEX, true);
  start.push({
    matcher: '.*',
    hooks: [{ type: 'command', command, commandWindows: windowsHookCommand(proxyPath, AGENT_FORMATS.CODEX, true) }],
  });
  await writeJson(hooksPath, model);
  await configureCodexTrust(agent, proxyPath, hooksPath);

  return true;
}

export async function hasCodexHooks(filePath: string, configPath: string, proxyPath: string): Promise<boolean> {
  const model = await readJsonOptional(filePath);
  const hooks = asRecord(model?.hooks);
  const hooksConfigured = Boolean(
    hooks &&
    hasNestedMcp(hooks[HOOK_EVENTS.CODEX_STOP], MCP_SERVER_NAME, LocalToolName.TriggerScan) &&
    hasMatching(hooks[HOOK_EVENTS.CODEX_START], `hook-start --format ${AGENT_FORMATS.CODEX}`),
  );

  if (!hooksConfigured) {
    return false;
  }

  const config = await readTomlOptional(configPath);
  const state = asRecord(asRecord(config?.hooks)?.state);
  const prefix = path.resolve(filePath);
  const stopState = asRecord(state?.[`${prefix}:${HOOK_EVENTS.CODEX_TRUST_STOP}:0:0`]);
  const startState = asRecord(state?.[`${prefix}:${HOOK_EVENTS.CODEX_TRUST_START}:0:0`]);
  const [expectedStopHash, expectedStartHash] = codexTrustHashes(proxyPath);

  return stopState?.trusted_hash === expectedStopHash && startState?.trusted_hash === expectedStartHash;
}

export async function removeCodexHooks(agent: AgentDefinition): Promise<boolean> {
  const filePath = agent.getHooksConfigPaths()[0];
  const changed = await removeClaudeCodeHooks(filePath);
  const trustStateChanged = await removeCodexTrustState(agent);

  return changed || trustStateChanged;
}

async function configureCodexTrust(agent: AgentDefinition, proxyPath: string, hooksPath: string): Promise<void> {
  const configPath = agent.getMcpConfigPaths()[0];
  const model = await readToml(configPath);
  const hooks = ensureRecord(model, 'hooks');
  const state = ensureRecord(hooks, 'state');
  const [stopHash, startHash] = codexTrustHashes(proxyPath);
  state[`${path.resolve(hooksPath)}:${HOOK_EVENTS.CODEX_TRUST_STOP}:0:0`] = { trusted_hash: stopHash, enabled: true };
  state[`${path.resolve(hooksPath)}:${HOOK_EVENTS.CODEX_TRUST_START}:0:0`] = { trusted_hash: startHash, enabled: true };
  const features = ensureRecord(model, 'features');
  features.hooks = true;
  await writeToml(configPath, model);
}

function codexTrustHashes(proxyPath: string): [string, string] {
  const stopHash = hookHash(HOOK_EVENTS.CODEX_TRUST_STOP, {
    type: 'mcp_tool',
    server: MCP_SERVER_NAME,
    tool: LocalToolName.TriggerScan,
    timeout: 600,
    input: hookInput(AGENT_FORMATS.CODEX),
  });

  const startCommand = hookCommand(proxyPath, AGENT_FORMATS.CODEX, true);
  const startCommandWindows = windowsHookCommand(proxyPath, AGENT_FORMATS.CODEX, true);
  const startHash = hookHash(HOOK_EVENTS.CODEX_TRUST_START, {
    type: 'command',
    command: process.platform === Platform.Windows ? startCommandWindows : startCommand,
    timeout: 600,
    async: false,
  });

  return [stopHash, startHash];
}

async function removeCodexTrustState(agent: AgentDefinition): Promise<boolean> {
  const configPath = agent.getMcpConfigPaths()[0];
  const model = await readTomlOptional(configPath);
  const hooks = asRecord(model?.hooks);
  const state = asRecord(hooks?.state);

  if (!model || !state) {
    return false;
  }

  const hooksPath = path.resolve(agent.getHooksConfigPaths()[0]);
  const keys = [
    `${hooksPath}:${HOOK_EVENTS.CODEX_TRUST_STOP}:0:0`,
    `${hooksPath}:${HOOK_EVENTS.CODEX_TRUST_START}:0:0`,
  ];

  let changed = false;

  for (const key of keys) {
    if (key in state) {
      delete state[key];
      changed = true;
    }
  }

  if (changed) {
    await writeToml(configPath, model);
  }

  return changed;
}

function hookHash(eventName: string, handler: Record<string, unknown>): string {
  const identity = { event_name: eventName, hooks: [handler] };
  const canonical = JSON.stringify(sortKeys(identity));

  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }

  return value;
}
