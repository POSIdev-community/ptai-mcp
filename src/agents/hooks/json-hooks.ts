import path from 'node:path';
import { LocalToolName } from '../../local/tool-names.js';
import { MCP_SERVER_NAME } from '../../mcp/constants.js';
import { AGENT_FORMATS, HOOK_EVENTS, RULES_DIRECTORY } from '../constants.js';
import { type AgentDefinition } from '../models.js';
import { appendRules, deleteStandaloneRules, removeRules, writeStandaloneRules } from '../rules.js';
import { hookCommand, hookInput, windsurfEntry } from './commands.js';
import { asRecord, ensureArray, ensureRecord, readJson, readJsonOptional, writeJson } from './config-file.js';
import {
  hasMatching,
  hasNestedMcp,
  hasOurHook,
  isOurMcpToolEntry,
  removeCommandEntries,
  removeEntries,
  removeMcpToolEntries,
} from './hook-entries.js';

export async function configureCursorHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
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
  await writeStandaloneRules(path.join(path.dirname(hooksPath), RULES_DIRECTORY, 'pt_ai_security.mdc'));

  return true;
}

export async function configureClaudeCodeHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
  const settingsPath = agent.getHooksConfigPaths()[0];
  const model = await readJson(settingsPath);
  const hooks = ensureRecord(model, 'hooks');
  const stop = ensureArray(hooks, HOOK_EVENTS.CLAUDE_STOP);
  const start = ensureArray(hooks, HOOK_EVENTS.CLAUDE_START);
  removeMcpToolEntries(stop, MCP_SERVER_NAME, LocalToolName.TriggerScan);
  removeCommandEntries(start, `hook-start --format ${AGENT_FORMATS.CLAUDE_CODE}`);
  stop.push({
    matcher: '.*',
    hooks: [
      {
        type: 'mcp_tool',
        server: MCP_SERVER_NAME,
        tool: LocalToolName.TriggerScan,
        input: hookInput(AGENT_FORMATS.CLAUDE_CODE),
      },
    ],
  });
  start.push({
    matcher: '.*',
    hooks: [{ type: 'command', command: hookCommand(proxyPath, AGENT_FORMATS.CLAUDE_CODE, true) }],
  });
  await writeJson(settingsPath, model);

  return true;
}

export async function configureWindsurfHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
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

export async function hasJsonHooks(
  filePath: string,
  stopKey: string,
  startKey: string,
  format: string,
): Promise<boolean> {
  const model = await readJsonOptional(filePath);

  if (!model) {
    return false;
  }

  const hooks = asRecord(model.hooks);

  return Boolean(
    hooks &&
    hasMatching(hooks[stopKey], `hook --format ${format}`) &&
    hasMatching(hooks[startKey], `hook-start --format ${format}`),
  );
}

export async function hasClaudeCodeHooks(filePath: string): Promise<boolean> {
  const model = await readJsonOptional(filePath);
  const hooks = asRecord(model?.hooks);

  return Boolean(
    hooks &&
    hasNestedMcp(hooks[HOOK_EVENTS.CLAUDE_STOP], MCP_SERVER_NAME, LocalToolName.TriggerScan) &&
    hasMatching(hooks[HOOK_EVENTS.CLAUDE_START], `hook-start --format ${AGENT_FORMATS.CLAUDE_CODE}`),
  );
}

export async function removeJsonHooks(filePath: string, keys: string[], identifiers: string[]): Promise<boolean> {
  const model = await readJsonOptional(filePath);

  if (!model) {
    return false;
  }

  const hooks = asRecord(model.hooks);

  if (!hooks) {
    return false;
  }

  let changed = false;

  for (const key of keys) {
    const array = Array.isArray(hooks[key]) ? (hooks[key] as unknown[]) : [];
    const filtered = array.filter((entry) => !identifiers.some((identifier) => hasOurHook(entry, identifier)));
    changed ||= filtered.length !== array.length;
    hooks[key] = filtered;
  }

  if (changed) {
    await writeJson(filePath, model);
  }

  if (filePath.includes(`${path.sep}.cursor${path.sep}`)) {
    await deleteStandaloneRules(path.join(path.dirname(filePath), RULES_DIRECTORY, 'pt_ai_security.mdc'));
  }

  if (filePath.includes(`${path.sep}.codeium${path.sep}`)) {
    await removeRules(path.join(path.dirname(filePath), 'memories', 'global_rules.md'));
  }

  return changed;
}

export async function removeClaudeCodeHooks(filePath: string): Promise<boolean> {
  const model = await readJsonOptional(filePath);
  const hooks = asRecord(model?.hooks);

  if (!hooks) {
    return false;
  }

  let changed = false;

  for (const key of [HOOK_EVENTS.CLAUDE_STOP, HOOK_EVENTS.CLAUDE_START]) {
    const array = Array.isArray(hooks[key]) ? (hooks[key] as unknown[]) : [];
    const filtered = array.filter((entry) => {
      const isOurStopHook =
        key === HOOK_EVENTS.CLAUDE_STOP && isOurMcpToolEntry(entry, MCP_SERVER_NAME, LocalToolName.TriggerScan);

      const isOurStartHook =
        key === HOOK_EVENTS.CLAUDE_START && hasOurHook(entry, `hook-start --format ${AGENT_FORMATS.CLAUDE_CODE}`);

      return !isOurStopHook && !isOurStartHook;
    });

    changed ||= filtered.length !== array.length;
    hooks[key] = filtered;
  }

  if (changed) {
    await writeJson(filePath, model!);
  }

  return changed;
}
