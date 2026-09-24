import fs from 'node:fs';
import cliProgress from 'cli-progress';
import { confirm, isCancel } from '@clack/prompts';
import { logger as log } from '../utils/logger.js';
import { configureCommand } from './configure.js';
import { killAnalyzerProcesses } from '../utils/processes.js';
import { downloadBundle, unpackBundle } from '../utils/downloader.js';
import { getDownloadSecurityOptions } from '../utils/downloadSecurity.js';
import { formatTransfer } from '../utils/progress.js';
import {
  getBundleDir,
  getExpectedBundleVersion,
  getProxyPath,
  getVersionsPath,
  readVersionsJson,
} from '../utils/paths.js';

export async function installCommand(): Promise<void> {
  const newVersion = getExpectedBundleVersion();
  if (!newVersion) {
    throw new Error('Bundle version is not configured in package.json.');
  }

  const currentVersion = readVersionsJson()?.['AI.INFRASTRUCTURE.INSTALLATOR'];
  const bundleExists = fs.existsSync(getProxyPath()) || fs.existsSync(getVersionsPath());

  if (bundleExists) {
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

  const abortController = new AbortController();
  const onSigint = () => abortController.abort();
  process.once('SIGINT', onSigint);

  let progressBar: cliProgress.SingleBar | undefined;
  let extractionBar: cliProgress.SingleBar | undefined;
  try {
    log.step('Stopping analyzer processes...');
    await killAnalyzerProcesses();

    log.step('Downloading analyzer bundle...');
    const downloadResult = await downloadBundle({
      version: newVersion,
      signal: abortController.signal,
      ...getDownloadSecurityOptions(),
      onProgress: ({ downloaded, total }) => {
        if (total <= 0) return;
        if (!progressBar) {
          progressBar = new cliProgress.SingleBar(
            {
              format: '  [{bar}] {percentage}% | {bytes}',
              hideCursor: true,
            },
            cliProgress.Presets.shades_classic,
          );
          progressBar.start(total, downloaded, { bytes: formatTransfer(downloaded, total) });
        } else {
          progressBar.update(Math.min(downloaded, total), { bytes: formatTransfer(downloaded, total) });
        }
      },
    });
    progressBar?.stop();
    progressBar = undefined;

    log.step('Unpacking analyzer bundle...');
    await unpackBundle(downloadResult.archivePath, getBundleDir(), undefined, ({ extracted, total }) => {
      if (!extractionBar) {
        extractionBar = new cliProgress.SingleBar(
          { format: '  [{bar}] {percentage}% | {value}/{total} files', hideCursor: true },
          cliProgress.Presets.shades_classic,
        );
        extractionBar.start(total, extracted);
      } else {
        extractionBar.update(extracted);
      }
    });
    extractionBar?.stop();

    if (process.platform !== 'darwin') {
      fs.rmSync(downloadResult.archivePath, { force: true });
    }

    log.success(`Bundle ${newVersion} installed.`);
    await configureCommand();
  } finally {
    progressBar?.stop();
    extractionBar?.stop();
    process.removeListener('SIGINT', onSigint);
  }
}
