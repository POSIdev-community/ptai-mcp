import fs from 'node:fs';
import { getConfigurationStatus } from './configure.js';
import { getBundleDir, getExpectedBundleVersion, getProxyPath, readVersionsJson } from '../utils/paths.js';
import { logger } from '../utils/logger.js';
import { isAgentDetected } from '../agents/registry.js';
import { getPackageName, getPackageVersion } from '../utils/packageMetadata.js';

export async function statusCommand(): Promise<void> {
  const expected = getExpectedBundleVersion() ?? 'unknown';
  const current = readVersionsJson()?.['AI.INFRASTRUCTURE.INSTALLATOR'] ?? 'not installed';
  const proxyPath = getProxyPath();
  const installed = fs.existsSync(proxyPath);

  logger.info('PT AI MCP status');
  logger.info(`Package:     ${getPackageName()} v${getPackageVersion()}`);
  logger.info('');
  logger.info('Analyzer bundle');
  logger.info(`  Status:     ${installed ? 'installed' : 'not installed'}`);
  logger.info(`  Version:    ${current}`);
  logger.info(`  Expected:   ${expected}`);
  logger.info(`  Location:   ${getBundleDir()}`);
  logger.info(`  Executable: ${proxyPath}`);
  logger.info(`  Health:     ${getBundleHealth(installed, current, expected)}`);

  const statuses = await getConfigurationStatus();
  if (statuses.length === 0) {
    logger.info('');
    logger.info(`Agents: unsupported on ${process.platform}`);
    return;
  }

  const detected = statuses.filter(({ agent }) => isAgentDetected(agent));
  const notDetected = statuses.filter(({ agent }) => !isAgentDetected(agent));

  logger.info('');
  logger.info('Detected agents');
  if (detected.length === 0) {
    logger.info('  None detected');
  } else {
    for (const status of detected) printAgentStatus(status);
  }

  logger.info('');
  logger.info('Supported but not detected');
  if (notDetected.length === 0) {
    logger.info('  None');
  } else {
    logger.info(`  ${notDetected.map(({ agent }) => agent.displayName).join(', ')}`);
  }
}

type AgentStatus = Awaited<ReturnType<typeof getConfigurationStatus>>[number];

function printAgentStatus({ agent, mcp, hooks }: AgentStatus): void {
  logger.info(`  ${agent.displayName}`);
  logger.info(`    MCP:   ${formatConfigured(mcp)}  ${agent.getMcpConfigPaths().join(', ')}`);
  logger.info(
    agent.supportsHooks
      ? `    Hooks: ${formatConfigured(Boolean(hooks))}  ${agent.getHooksConfigPaths().join(', ')}`
      : '    Hooks: not supported by this agent',
  );
}

function formatConfigured(configured: boolean): string {
  return configured ? '✓ configured' : '○ not configured';
}

function getBundleHealth(installed: boolean, current: string, expected: string): string {
  if (!installed) return 'install required';
  if (expected === 'unknown' || current === 'not installed') return 'version unknown';
  return current === expected ? 'up to date' : 'update available';
}
