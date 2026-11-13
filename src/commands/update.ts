import { isCurrentBundleInstalled, runBundleOperation } from '../services/bundle.js';
import { INSTALLER_PRODUCT_ID } from '../services/bundle-constants.js';
import { logger as log } from '../utils/logger.js';
import { getExpectedBundleVersion, readVersionsJson } from '../utils/paths.js';

export async function updateCommand(): Promise<void> {
  const version = getExpectedBundleVersion();

  if (!version) {
    throw new Error('Bundle version is not configured in package.json.');
  }

  const current = readVersionsJson()?.[INSTALLER_PRODUCT_ID];

  if (isCurrentBundleInstalled(version)) {
    log.info(`Bundle ${version} is already up to date.`);

    return;
  }

  log.info(`Updating analyzer bundle ${current ? `${current} → ` : ''}${version}`);
  await runBundleOperation({ version, successMessage: `Bundle ${version} updated.` });
}
