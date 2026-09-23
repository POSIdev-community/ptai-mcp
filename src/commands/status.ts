import fs from 'node:fs';
import { getConfigurationStatus } from './configure.js';
import { getBundleDir, getExpectedBundleVersion, getProxyPath, readVersionsJson } from '../utils/paths.js';
import { logger } from '../utils/logger.js';

export async function statusCommand(): Promise<void> {
  const expected = getExpectedBundleVersion() ?? 'unknown';
  const current = readVersionsJson()?.['AI.INFRASTRUCTURE.INSTALLATOR'] ?? 'not installed';
  const installed = fs.existsSync(getProxyPath());

  logger.info(`Bundle directory: ${getBundleDir()}`);
  logger.info(`Proxy: ${installed ? 'installed' : 'not installed'}`);
  logger.info(`Installed version: ${current}`);
  logger.info(`Expected version: ${expected}`);

  const statuses = await getConfigurationStatus();
  if (statuses.length === 0) {
    logger.info(`Agents: unsupported on ${process.platform}`);
    return;
  }

  logger.info('Agents:');
  for (const { agent, mcp, hooks } of statuses) {
    logger.info(
      `  ${agent.displayName}: MCP ${mcp ? 'configured' : 'not configured'}, hooks ${hooks ? 'configured' : 'not configured'}`,
    );
  }
}
