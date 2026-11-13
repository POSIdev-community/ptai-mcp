import { confirm, isCancel } from '@clack/prompts';
import { isCurrentBundleInstalled, runBundleOperation } from '../services/bundle.js';
import { INSTALLER_PRODUCT_ID } from '../services/bundle-constants.js';
import { logger as log } from '../utils/logger.js';
import { getExpectedBundleVersion, readVersionsJson } from '../utils/paths.js';
import { configureCommand } from './configure.js';

export async function installCommand(): Promise<void> {
  const newVersion = getExpectedBundleVersion();

  if (!newVersion) {
    throw new Error('Bundle version is not configured in package.json.');
  }

  if (isCurrentBundleInstalled(newVersion)) {
    log.info(`Bundle ${newVersion} is already up to date.`);
    await configureCommand({ localHooks: true });

    return;
  }

  const currentVersion = readVersionsJson()?.[INSTALLER_PRODUCT_ID];
  log.info(
    'The analyzer bundle is optional. It is required for local analysis tools and hooks. AIE server tools work without it.',
  );
  log.info(
    `Installed bundle: ${currentVersion ?? 'not installed or version unknown'}. Required version for local analysis: ${newVersion}.`,
  );
  const shouldInstall = await confirm({
    message: `Download and install analyzer bundle ${newVersion} for local analysis?`,
    initialValue: false,
  });

  if (isCancel(shouldInstall)) {
    log.info('Installation cancelled.');

    return;
  }

  if (shouldInstall) {
    await runBundleOperation({ version: newVersion, successMessage: `Bundle ${newVersion} installed.` });
  } else {
    log.info(
      'Bundle installation skipped. Continuing with MCP setup for AIE server tools; local hooks setup is skipped.',
    );
  }

  await configureCommand({ localHooks: shouldInstall });
}
