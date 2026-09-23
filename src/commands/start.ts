import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { getExpectedBundleVersion, getProxyPath, readVersionsJson } from '../utils/paths.js';
import { logger } from '../utils/logger.js';

export function startCommand() {
  const proxyPath = getProxyPath();

  if (!fs.existsSync(proxyPath)) {
    logger.error(`McpProxy not found at: ${proxyPath}`);
    logger.error(`Please run 'npx @posidev-community/ptai-mcp install' first.`);
    process.exit(1);
  }

  // Check version warning
  try {
    const expectedVersion = getExpectedBundleVersion();

    if (expectedVersion) {
      const versions = readVersionsJson();
      const currentVersion = versions?.['AI.INFRASTRUCTURE.INSTALLATOR'];

      if (currentVersion && currentVersion !== expectedVersion) {
        logger.warn(`Bundle version mismatch.`);
        logger.warn(`Current: ${currentVersion}`);
        logger.warn(`Expected: ${expectedVersion}`);
        logger.warn(`Consider running 'npx @posidev-community/ptai-mcp update'.`);
      }
    }
  } catch {
    // Ignore version check errors
  }

  // Pass remaining arguments if any
  const args = process.argv.slice(3);

  const child = spawn(proxyPath, args, {
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('error', (err) => {
    logger.error(`Failed to start McpProxy: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
