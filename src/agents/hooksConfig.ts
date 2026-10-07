import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import TOML from '@iarna/toml';
import type { AgentDefinition } from './registry.js';
import { MCP_SERVER_NAME } from './mcpConfig.js';
import {
  bundleLaunch,
  hookCommand as formatHookCommand,
  isOurHookCommand as isOurLaunchHookCommand,
  windowsHookCommand as formatWindowsHookCommand,
} from './launch.js';
import { appendRules, deleteStandaloneRules, removeRules, writeStandaloneRules } from './rules.js';
import { HOOK_EVENTS, AGENT_FORMATS, STOP_TOOL_NAME, AGENT_IDS } from './constants.js';
import { getProxyPath } from '../utils/paths.js';
import { configureOpenCodeHooks, isOpenCodeHooksConfigured, removeOpenCodeHooks } from './openCode.js';

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

type HookAdapter = {
  configure: (agent: AgentDefinition, proxyPath: string) => Promise<boolean>;
  isConfigured: (agent: AgentDefinition, proxyPath: string) => Promise<boolean>;
  remove: (agent: AgentDefinition) => Promise<boolean>;
};

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

async function unsupportedConfigure(): Promise<boolean> {
  return false;
}

async function unsupportedRemove(): Promise<boolean> {
  return false;
}

async function hasGeminiRules(): Promise<boolean> {
  return (
    (
      await readOptional(path.join(process.env.USERPROFILE || process.env.HOME || '', '.gemini', 'GEMINI.md'))
    )?.includes('PT AI Security Rules') === true
  );
}

async function configureCursorHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
  const hooksPath = agent.getHooksConfigPaths()[0];
  const model = await readJson(hooksPath);
  const hooks = ensureRecord(model, 'hooks');
  const stop = ensureArray(hooks, HOOK_EVENTS.CURSOR_STOP);
  const start = ensureArray(hooks, HOOK_EVENTS.CURSOR_START);
  removeEntries(stop, [`hook --format ${AGENT_FORMATS.CURSOR}`]);
  removeEntries(start, [`hook-start --format ${AGENT_FORMATS.CURSOR}`]);
  stop.push({ show_output: true, loop_limit: 1, timeout: 600, command: hookCommand(proxyPath, AGENT_FORMATS.CURSOR) });
  start.push({
    show_output: false,
    loop_limit: 1,
    timeout: 30,
    command: hookCommand(proxyPath, AGENT_FORMATS.CURSOR, true),
  });
  model.version = 1;
  await writeJson(hooksPath, model);
  await writeStandaloneRules(path.join(path.dirname(hooksPath), 'rules', 'pt_ai_security.mdc'));
  return true;
}

async function configureClaudeCodeHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
  const settingsPath = agent.getHooksConfigPaths()[0];
  const model = await readJson(settingsPath);
  const hooks = ensureRecord(model, 'hooks');
  const stop = ensureArray(hooks, HOOK_EVENTS.CLAUDE_STOP);
  const start = ensureArray(hooks, HOOK_EVENTS.CLAUDE_START);
  removeMcpToolEntries(stop, MCP_SERVER_NAME, STOP_TOOL_NAME);
  removeCommandEntries(start, `hook-start --format ${AGENT_FORMATS.CLAUDE_CODE}`);
  stop.push({
    matcher: '.*',
    hooks: [
      { type: 'mcp_tool', server: MCP_SERVER_NAME, tool: STOP_TOOL_NAME, input: hookInput(AGENT_FORMATS.CLAUDE_CODE) },
    ],
  });
  start.push({
    matcher: '.*',
    hooks: [{ type: 'command', command: hookCommand(proxyPath, AGENT_FORMATS.CLAUDE_CODE, true) }],
  });
  await writeJson(settingsPath, model);
  return true;
}

async function configureWindsurfHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
  const hooksPath = agent.getHooksConfigPaths()[0];
  const model = await readJson(hooksPath);
  const hooks = ensureRecord(model, 'hooks');
  const stop = ensureArray(hooks, HOOK_EVENTS.WINDSURF_STOP);
  const start = ensureArray(hooks, HOOK_EVENTS.WINDSURF_START);
  removeEntries(stop, [`hook --format ${AGENT_FORMATS.WINDSURF}`]);
  removeEntries(start, [`hook-start --format ${AGENT_FORMATS.WINDSURF}`]);
  stop.push(windsurfEntry(proxyPath, AGENT_FORMATS.WINDSURF));
  start.push(windsurfEntry(proxyPath, AGENT_FORMATS.WINDSURF, true));
  await writeJson(hooksPath, model);
  await appendRules(path.join(path.dirname(hooksPath), 'memories', 'global_rules.md'));
  return true;
}

async function configureKimiHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
  const configPath = agent.getHooksConfigPaths()[0];
  const model = await readToml(configPath);
  const hooks = Array.isArray(model.hooks) ? (model.hooks as Record<string, unknown>[]) : [];
  const filtered = hooks.filter(
    (hook) =>
      ![`hook --format ${AGENT_FORMATS.KIMI}`, `hook-start --format ${AGENT_FORMATS.KIMI}`].some((identifier) =>
        isOurHookCommand(String(hook.command ?? ''), identifier),
      ),
  );
  filtered.push({
    event: HOOK_EVENTS.KIMI_STOP,
    matcher: '.*',
    command: hookCommand(proxyPath, AGENT_FORMATS.KIMI),
    timeout: 600,
  });
  filtered.push({
    event: HOOK_EVENTS.KIMI_START,
    matcher: '.*',
    command: hookCommand(proxyPath, AGENT_FORMATS.KIMI, true),
    timeout: 600,
  });
  model.hooks = filtered;
  await writeToml(configPath, model);
  return true;
}

async function configureCodexHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
  const hooksPath = agent.getHooksConfigPaths()[0];
  const model = await readJson(hooksPath);
  const hooks = ensureRecord(model, 'hooks');
  const stop = ensureArray(hooks, HOOK_EVENTS.CODEX_STOP);
  const start = ensureArray(hooks, HOOK_EVENTS.CODEX_START);
  removeMcpToolEntries(stop, MCP_SERVER_NAME, STOP_TOOL_NAME);
  removeCommandEntries(start, `hook-start --format ${AGENT_FORMATS.CODEX}`);
  stop.push({
    matcher: '.*',
    hooks: [{ type: 'mcp_tool', server: MCP_SERVER_NAME, tool: STOP_TOOL_NAME, input: hookInput(AGENT_FORMATS.CODEX) }],
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

async function configureAntigravityHooks(): Promise<boolean> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  await appendRules(path.join(home, '.gemini', 'GEMINI.md'));
  const workflow = path.join(home, '.gemini', 'config', 'global_workflows', 'pt_ai_security_scan.md');
  const content = `---\nname: PT AI Security Scan\ndescription: Run PT Application Inspector after significant code changes\n---\n\nAfter completing security-relevant changes, call the MCP tool \`trigger_scan\` with mode \`incremental\`, review affected files, and fix or triage findings before reporting success.\n`;
  await ensureParent(workflow);
  if ((await readOptional(workflow)) !== content) await fs.writeFile(workflow, content, 'utf8');
  return true;
}

async function configureGeminiCliHooks(): Promise<boolean> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  await appendRules(path.join(home, '.gemini', 'GEMINI.md'));
  return true;
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
    tool: STOP_TOOL_NAME,
    timeout: 600,
    input: hookInput(AGENT_FORMATS.CODEX),
  });
  const startCommand = hookCommand(proxyPath, AGENT_FORMATS.CODEX, true);
  const startCommandWindows = windowsHookCommand(proxyPath, AGENT_FORMATS.CODEX, true);
  const startHash = hookHash(HOOK_EVENTS.CODEX_TRUST_START, {
    type: 'command',
    command: process.platform === 'win32' ? startCommandWindows : startCommand,
    timeout: 600,
    async: false,
  });
  return [stopHash, startHash];
}

async function hasJsonHooks(filePath: string, stopKey: string, startKey: string, format: string): Promise<boolean> {
  const model = await readJsonOptional(filePath);
  if (!model) return false;
  const hooks = asRecord(model.hooks);
  return Boolean(
    hooks &&
    hasMatching(hooks[stopKey], `hook --format ${format}`) &&
    hasMatching(hooks[startKey], `hook-start --format ${format}`),
  );
}

async function hasClaudeCodeHooks(filePath: string): Promise<boolean> {
  const model = await readJsonOptional(filePath);
  const hooks = asRecord(model?.hooks);
  return Boolean(
    hooks &&
    hasNestedMcp(hooks[HOOK_EVENTS.CLAUDE_STOP], MCP_SERVER_NAME, STOP_TOOL_NAME) &&
    hasMatching(hooks[HOOK_EVENTS.CLAUDE_START], `hook-start --format ${AGENT_FORMATS.CLAUDE_CODE}`),
  );
}

async function hasKimiHooks(filePath: string): Promise<boolean> {
  const model = await readTomlOptional(filePath);
  const hooks = Array.isArray(model?.hooks) ? (model?.hooks as Record<string, unknown>[]) : [];
  return (
    hooks.some(
      (hook) =>
        hook.event === HOOK_EVENTS.KIMI_STOP &&
        isOurHookCommand(String(hook.command ?? ''), `hook --format ${AGENT_FORMATS.KIMI}`),
    ) &&
    hooks.some(
      (hook) =>
        hook.event === HOOK_EVENTS.KIMI_START &&
        isOurHookCommand(String(hook.command ?? ''), `hook-start --format ${AGENT_FORMATS.KIMI}`),
    )
  );
}

async function hasCodexHooks(filePath: string, configPath: string, proxyPath: string): Promise<boolean> {
  const model = await readJsonOptional(filePath);
  const hooks = asRecord(model?.hooks);
  const hooksConfigured = Boolean(
    hooks &&
    hasNestedMcp(hooks[HOOK_EVENTS.CODEX_STOP], MCP_SERVER_NAME, STOP_TOOL_NAME) &&
    hasMatching(hooks[HOOK_EVENTS.CODEX_START], `hook-start --format ${AGENT_FORMATS.CODEX}`),
  );
  if (!hooksConfigured) return false;

  const config = await readTomlOptional(configPath);
  const state = asRecord(asRecord(config?.hooks)?.state);
  const prefix = path.resolve(filePath);
  const stopState = asRecord(state?.[`${prefix}:${HOOK_EVENTS.CODEX_TRUST_STOP}:0:0`]);
  const startState = asRecord(state?.[`${prefix}:${HOOK_EVENTS.CODEX_TRUST_START}:0:0`]);
  const [expectedStopHash, expectedStartHash] = codexTrustHashes(proxyPath);
  return stopState?.trusted_hash === expectedStopHash && startState?.trusted_hash === expectedStartHash;
}

async function removeJsonHooks(filePath: string, keys: string[], identifiers: string[]): Promise<boolean> {
  const model = await readJsonOptional(filePath);
  if (!model) return false;
  const hooks = asRecord(model.hooks);
  if (!hooks) return false;
  let changed = false;
  for (const key of keys) {
    const array = Array.isArray(hooks[key]) ? (hooks[key] as unknown[]) : [];
    const filtered = array.filter((entry) => !identifiers.some((identifier) => hasOurHook(entry, identifier)));
    changed ||= filtered.length !== array.length;
    hooks[key] = filtered;
  }
  if (changed) await writeJson(filePath, model);
  if (filePath.includes(`${path.sep}.cursor${path.sep}`))
    await deleteStandaloneRules(path.join(path.dirname(filePath), 'rules', 'pt_ai_security.mdc'));
  if (filePath.includes(`${path.sep}.codeium${path.sep}`))
    await removeRules(path.join(path.dirname(filePath), 'memories', 'global_rules.md'));
  return changed;
}

async function removeClaudeCodeHooks(filePath: string): Promise<boolean> {
  const model = await readJsonOptional(filePath);
  const hooks = asRecord(model?.hooks);
  if (!hooks) return false;
  let changed = false;
  for (const key of [HOOK_EVENTS.CLAUDE_STOP, HOOK_EVENTS.CLAUDE_START]) {
    const array = Array.isArray(hooks[key]) ? (hooks[key] as unknown[]) : [];
    const filtered = array.filter((entry) => {
      const isOurStopHook =
        key === HOOK_EVENTS.CLAUDE_STOP && isOurMcpToolEntry(entry, MCP_SERVER_NAME, STOP_TOOL_NAME);
      const isOurStartHook =
        key === HOOK_EVENTS.CLAUDE_START && hasOurHook(entry, `hook-start --format ${AGENT_FORMATS.CLAUDE_CODE}`);
      return !isOurStopHook && !isOurStartHook;
    });
    changed ||= filtered.length !== array.length;
    hooks[key] = filtered;
  }
  if (changed) await writeJson(filePath, model!);
  return changed;
}

async function removeKimiHooks(filePath: string): Promise<boolean> {
  const model = await readTomlOptional(filePath);
  if (!model) return false;
  const hooks = Array.isArray(model.hooks) ? (model.hooks as Record<string, unknown>[]) : [];
  const filtered = hooks.filter(
    (hook) =>
      ![`hook --format ${AGENT_FORMATS.KIMI}`, `hook-start --format ${AGENT_FORMATS.KIMI}`].some((identifier) =>
        isOurHookCommand(String(hook.command ?? ''), identifier),
      ),
  );
  if (filtered.length === hooks.length) return false;
  model.hooks = filtered;
  await writeToml(filePath, model);
  return true;
}

async function removeCodexHooks(agent: AgentDefinition): Promise<boolean> {
  const filePath = agent.getHooksConfigPaths()[0];
  const changed = await removeClaudeCodeHooks(filePath);
  const trustStateChanged = await removeCodexTrustState(agent);
  return changed || trustStateChanged;
}

async function removeCodexTrustState(agent: AgentDefinition): Promise<boolean> {
  const configPath = agent.getMcpConfigPaths()[0];
  const model = await readTomlOptional(configPath);
  const hooks = asRecord(model?.hooks);
  const state = asRecord(hooks?.state);
  if (!model || !state) return false;

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
  if (changed) await writeToml(configPath, model);
  return changed;
}

async function removeAntigravityHooks(): Promise<boolean> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  await removeRules(path.join(home, '.gemini', 'GEMINI.md'));
  await deleteStandaloneRules(path.join(home, '.gemini', 'config', 'global_workflows', 'pt_ai_security_scan.md'));
  return true;
}

async function removeGeminiCliHooks(): Promise<boolean> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  await removeRules(path.join(home, '.gemini', 'GEMINI.md'));
  return true;
}

function hookCommand(proxyPath: string, format: string, start = false): string {
  return formatHookCommand(bundleLaunch(proxyPath, [start ? 'hook-start' : 'hook', '--format', format]));
}

function windowsHookCommand(proxyPath: string, format: string, start = false): string {
  return formatWindowsHookCommand(bundleLaunch(proxyPath, [start ? 'hook-start' : 'hook', '--format', format]));
}

function windsurfEntry(proxyPath: string, format: string, start = false): Record<string, unknown> {
  const entry: Record<string, unknown> = { show_output: !start };
  if (process.platform === 'win32') {
    entry.powershell = hookCommand(proxyPath, format, start);
    entry.command = `${proxyPath} ${start ? 'hook-start' : 'hook'} --format ${format}`;
  } else {
    entry.command = hookCommand(proxyPath, format, start);
  }
  return entry;
}

function hookInput(format: string): Record<string, string> {
  return { source: 'hook', mode: 'incremental', hookFormat: format, stopHookActive: '${stop_hook_active}' };
}

function hasMatching(value: unknown, identifier: string): boolean {
  return Array.isArray(value) && value.some((entry) => hasOurHook(entry, identifier));
}

function hasNestedMcp(value: unknown, server: string, tool: string): boolean {
  return Array.isArray(value) && value.some((entry) => isOurMcpToolEntry(entry, server, tool));
}

function removeEntries(array: unknown[], identifiers: string[]): void {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (identifiers.some((identifier) => hasOurHook(array[i], identifier))) array.splice(i, 1);
  }
}

function removeCommandEntries(array: unknown[], identifier: string): void {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (hasOurHook(array[i], identifier)) array.splice(i, 1);
  }
}

function hasOurHook(value: unknown, identifier: string): boolean {
  return stringValues(value).some((candidate) => isOurHookCommand(candidate, identifier));
}

function isOurHookCommand(command: string, identifier: string): boolean {
  return isOurLaunchHookCommand(command, identifier);
}

function isOurMcpToolEntry(value: unknown, server: string, tool: string): boolean {
  const record = asRecord(value);
  return record?.server === server && record.tool === tool
    ? true
    : Array.isArray(record?.hooks) && record.hooks.some((entry) => isOurMcpToolEntry(entry, server, tool));
}

function removeMcpToolEntries(array: unknown[], server: string, tool: string): void {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (isOurMcpToolEntry(array[i], server, tool)) array.splice(i, 1);
  }
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(stringValues);
  return [];
}

function ensureArray(parent: Record<string, unknown>, key: string): unknown[] {
  if (Array.isArray(parent[key])) return parent[key] as unknown[];
  const created: unknown[] = [];
  parent[key] = created;
  return created;
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

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const source = await readOptional(filePath);
  return source === null || source.trim() === '' ? {} : (JSON.parse(source) as Record<string, unknown>);
}

async function readJsonOptional(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null;
  }
}

async function writeJson(filePath: string, model: Record<string, unknown>): Promise<void> {
  await ensureParent(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
}

async function readToml(filePath: string): Promise<Record<string, unknown>> {
  const source = await readOptional(filePath);
  return source === null || source.trim() === '' ? {} : (TOML.parse(source) as Record<string, unknown>);
}

async function readTomlOptional(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return TOML.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null;
  }
}

async function writeToml(filePath: string, model: Record<string, unknown>): Promise<void> {
  await ensureParent(filePath);
  await fs.writeFile(filePath, TOML.stringify(model as TOML.JsonMap), 'utf8');
}

async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function ensureParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function hookHash(eventName: string, handler: Record<string, unknown>): string {
  const identity = { event_name: eventName, hooks: [handler] };
  const canonical = JSON.stringify(sortKeys(identity));
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}
