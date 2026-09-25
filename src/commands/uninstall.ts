import fs from 'node:fs/promises';
import { confirm, isCancel } from '@clack/prompts';
import { logger as log } from '../utils/logger.js';
import { getSupportedAgents } from '../agents/registry.js';
import { removeHooks } from '../agents/hooksConfig.js';
import { removeMcp } from '../agents/mcpConfig.js';
import { killAnalyzerProcesses } from '../utils/processes.js';
import { getBundleDir } from '../utils/paths.js';

export async function uninstallCommand(): Promise<void> {
  const confirmed = await confirm({
    message: `Remove the analyzer bundle and ptai_analyzer configuration?`,
    initialValue: false,
  });
  if (isCancel(confirmed) || !confirmed) {
    log.info('Uninstall cancelled.');
    return;
  }

  await killAnalyzerProcesses();
  for (const agent of getSupportedAgents()) {
    for (const configPath of agent.getMcpConfigPaths()) {
      try {
        await removeMcp(agent, configPath);
      } catch {
        /* preserve unrelated config */
      }
    }
    if (agent.supportsHooks) {
      try {
        await removeHooks(agent);
      } catch {
        /* preserve unrelated config */
      }
    }
  }

  const bundleDir = getBundleDir();
  await fs.rm(bundleDir, { recursive: true, force: true });
  log.success(`Removed analyzer bundle from ${bundleDir}.`);
}
