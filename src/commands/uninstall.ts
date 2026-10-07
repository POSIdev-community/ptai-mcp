import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { confirm, isCancel } from '@clack/prompts';
import { logger as log } from '../utils/logger.js';
import { getSupportedAgents } from '../agents/registry.js';
import { removeHooks } from '../agents/hooksConfig.js';
import { removeMcp } from '../agents/mcpConfig.js';
import { killAnalyzerProcesses } from '../utils/processes.js';
import { getBundleDir } from '../utils/paths.js';
import { removeCustomAgentGuide } from '../agents/customAgent.js';

const execFileAsync = promisify(execFile);
type CommandRunner = (file: string, args: readonly string[]) => Promise<unknown>;

export async function uninstallCommand(): Promise<void> {
  const confirmed = await confirm({
    message: `Remove the analyzer bundle and ptai_analyzer configuration?`,
    initialValue: false,
  });
  if (isCancel(confirmed) || !confirmed) {
    log.info('Uninstall cancelled.');
    return;
  }

  log.step('Stopping analyzer processes...');
  const stopResult = await killAnalyzerProcesses();
  log.info(
    stopResult.stopped.length > 0
      ? `Stopped analyzer processes: ${stopResult.stopped.join(', ')}.`
      : 'No running analyzer processes found.',
  );

  const bundleDir = getBundleDir();
  log.step('Removing analyzer bundle...');
  await removeBundleDirectory(bundleDir);

  log.step('Removing PTAI agent configuration...');
  const cleanupErrors: string[] = [];
  for (const agent of getSupportedAgents()) {
    for (const configPath of agent.getMcpConfigPaths()) {
      try {
        await removeMcp(agent, configPath);
      } catch (error) {
        cleanupErrors.push(`${agent.displayName} MCP (${configPath}): ${formatError(error)}`);
      }
    }
    if (agent.supportsHooks) {
      try {
        await removeHooks(agent);
      } catch (error) {
        cleanupErrors.push(`${agent.displayName} hooks: ${formatError(error)}`);
      }
    }
  }
  try {
    await removeCustomAgentGuide();
  } catch (error) {
    cleanupErrors.push(`Custom agent setup guide: ${formatError(error)}`);
  }

  log.success(`Removed analyzer bundle from ${bundleDir}.`);
  if (cleanupErrors.length > 0) {
    throw new Error(
      `The bundle was removed, but some agent configuration could not be cleaned:\n${cleanupErrors.join('\n')}`,
    );
  }
  log.success('Removed PTAI agent configuration.');
}

export async function removeBundleDirectory(bundleDir: string, run: CommandRunner = execFileAsync): Promise<void> {
  try {
    await fs.rm(bundleDir, { recursive: true, force: true });
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (process.platform !== 'darwin' || (code !== 'EACCES' && code !== 'EPERM')) throw error;
  }

  const script =
    'on run argv\n' +
    'do shell script "/bin/rm -rf -- " & quoted form of (item 1 of argv) with administrator privileges\n' +
    'end run';
  try {
    await run('/usr/bin/osascript', ['-e', script, bundleDir]);
  } catch (error) {
    throw new Error(`Administrator permission is required to remove ${bundleDir}.`, { cause: error });
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
