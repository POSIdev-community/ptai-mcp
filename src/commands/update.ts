import fs from 'node:fs';
import { logger as log } from '../utils/logger.js';
import { runBundleOperation } from '../services/bundle.js';
import { getExpectedBundleVersion, getProxyPath, getVersionsPath, readVersionsJson } from '../utils/paths.js';

export async function updateCommand(): Promise<void> {
  const version = getExpectedBundleVersion();
  if (!version) throw new Error('Bundle version is not configured in package.json.');

  const current = readVersionsJson()?.['AI.INFRASTRUCTURE.INSTALLATOR'];
  const bundleExists = fs.existsSync(getProxyPath()) || fs.existsSync(getVersionsPath());
  if (bundleExists && current === version) {
    log.info(`Bundle ${version} is already up to date.`);
    return;
  }

  log.info(`Updating analyzer bundle ${current ? `${current} → ` : ''}${version}`);
  await runBundleOperation({ version, successMessage: `Bundle ${version} updated.` });
}
