import { AGENT_FORMATS, HOOK_EVENTS } from '../constants.js';
import { type AgentDefinition } from '../models.js';
import { hookCommand } from './commands.js';
import { readToml, readTomlOptional, writeToml } from './config-file.js';
import { isOurHookCommand } from './hook-entries.js';

export async function configureKimiHooks(agent: AgentDefinition, proxyPath: string): Promise<boolean> {
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

export async function hasKimiHooks(filePath: string): Promise<boolean> {
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

export async function removeKimiHooks(filePath: string): Promise<boolean> {
  const model = await readTomlOptional(filePath);

  if (!model) {
    return false;
  }

  const hooks = Array.isArray(model.hooks) ? (model.hooks as Record<string, unknown>[]) : [];
  const filtered = hooks.filter(
    (hook) =>
      ![`hook --format ${AGENT_FORMATS.KIMI}`, `hook-start --format ${AGENT_FORMATS.KIMI}`].some((identifier) =>
        isOurHookCommand(String(hook.command ?? ''), identifier),
      ),
  );

  if (filtered.length === hooks.length) {
    return false;
  }

  model.hooks = filtered;
  await writeToml(filePath, model);

  return true;
}
