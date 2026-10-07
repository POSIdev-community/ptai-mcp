import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import {
  getBackendPath,
  getBundleDir,
  getExpectedBundleVersion,
  getProxyPath,
  getVersionsPath,
  readVersionsJson,
} from '../utils/paths.js';
import { logger } from '../utils/logger.js';

export function startCommand() {
  const proxyPath = getProxyPath();

  if (!fs.existsSync(proxyPath)) {
    const oldBundleExists =
      fs.existsSync(getBundleDir()) || fs.existsSync(getVersionsPath()) || fs.existsSync(getBackendPath());
    logger.error(
      oldBundleExists
        ? `PT AI update available. Run 'ptai-mcp update' to update.`
        : `PT AI bundle is not installed. Please run 'npx -y @posidev-community/ptai-mcp install'.`,
    );
    process.exit(1);
  }

  // Check version warning
  try {
    const expectedVersion = getExpectedBundleVersion();

    if (expectedVersion) {
      const versions = readVersionsJson();
      const currentVersion = versions?.['AI.INFRASTRUCTURE.INSTALLATOR'];

      if (currentVersion && currentVersion !== expectedVersion) {
        logger.warn(`PT AI update available. Run 'ptai-mcp update' to update.`);
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

  child.on('exit', (code, signal) => {
    process.exit(resolveExitCode(code, signal));
  });
}

export function resolveExitCode(code: number | null, signal: NodeJS.Signals | null): number {
  if (code !== null) return code;
  if (signal) return 128 + (os.constants.signals[signal] ?? 0);
  return 1;
}
