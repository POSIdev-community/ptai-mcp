import fs from 'node:fs';
import { confirm, isCancel } from '@clack/prompts';
import { logger as log } from '../utils/logger.js';
import { configureCommand } from './configure.js';
import { runBundleOperation } from '../services/bundle.js';
import { getExpectedBundleVersion, getProxyPath, getVersionsPath, readVersionsJson } from '../utils/paths.js';

export async function installCommand(): Promise<void> {
  const newVersion = getExpectedBundleVersion();
  if (!newVersion) {
    throw new Error('Bundle version is not configured in package.json.');
  }

  const currentVersion = readVersionsJson()?.['AI.INFRASTRUCTURE.INSTALLATOR'];
  const bundleExists = fs.existsSync(getProxyPath()) || fs.existsSync(getVersionsPath());

  if (bundleExists) {
    if (currentVersion === newVersion) {
      log.info(`Bundle ${newVersion} is already up to date.`);
      return;
    }

    log.info(`Installed bundle: ${currentVersion ?? 'version unknown'}`);
    log.info(`Available bundle: ${newVersion}`);

    const shouldUpdate = await confirm({
      message: 'Download and install the available bundle?',
      initialValue: false,
    });

    if (isCancel(shouldUpdate)) {
      log.info('Installation cancelled.');
      return;
    }
    if (!shouldUpdate) {
      log.info('Installation skipped.');
      return;
    }
  }

  await runBundleOperation({ version: newVersion, successMessage: `Bundle ${newVersion} installed.` });
  await configureCommand();
}
