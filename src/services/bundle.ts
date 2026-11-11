import fs from 'node:fs';
import { getDownloadSecurityOptions } from '../utils/downloadSecurity.js';
import { logger as log } from '../utils/logger.js';
import { getBundleDir, getProxyPath, readVersionsJson } from '../utils/paths.js';
import { Platform } from '../utils/platform-constants.js';
import { killAnalyzerProcesses } from '../utils/processes.js';
import { INSTALLER_PRODUCT_ID } from './bundle-constants.js';
import { BundleProgress } from './bundle-progress.js';
import { downloadBundle } from './installer/download.js';
import { unpackBundle } from './installer/extraction.js';

export interface BundleOperationOptions {
  version: string;
  successMessage: string;
}

export async function runBundleOperation({ version, successMessage }: BundleOperationOptions): Promise<void> {
  const abortController = new AbortController();
  const onSigint = () => abortController.abort();
  process.once('SIGINT', onSigint);

  const progress = new BundleProgress();

  try {
    log.step('Stopping analyzer processes...');
    const initialStop = await killAnalyzerProcesses();
    log.info(formatStopResult(initialStop));

    log.step('Downloading analyzer bundle...');
    const downloadResult = await downloadBundle({
      version,
      signal: abortController.signal,
      ...getDownloadSecurityOptions(),
      onProgress: (event) => progress.download(event),
    });

    progress.finishDownload();

    // A host agent may restart the proxy while a multi-gigabyte bundle is downloading.
    // Re-check immediately before replacing files to avoid locked DLLs on Windows.
    log.step('Stopping analyzer processes before installation...');
    const finalStop = await killAnalyzerProcesses();
    log.info(formatStopResult(finalStop));

    log.step('Unpacking analyzer bundle...');
    await unpackBundle(downloadResult.archivePath, getBundleDir(), undefined, (event) => progress.extraction(event));
    progress.finishExtraction();

    if (process.platform === Platform.MacOS) {
      verifyMacInstallation(version);
    }

    fs.rmSync(downloadResult.archivePath, { force: true });
    log.success(successMessage);
  } finally {
    progress.close();
    process.removeListener('SIGINT', onSigint);
  }
}

function formatStopResult(result: Awaited<ReturnType<typeof killAnalyzerProcesses>>): string {
  return result.stopped.length > 0
    ? `Stopped analyzer processes: ${result.stopped.join(', ')}.`
    : 'No running analyzer processes found.';
}

function verifyMacInstallation(expectedVersion: string): void {
  const currentVersion = readVersionsJson()?.[INSTALLER_PRODUCT_ID];

  if (!fs.existsSync(getProxyPath()) || currentVersion !== expectedVersion) {
    throw new Error(
      `The macOS installer closed before bundle ${expectedVersion} was installed. Complete the installation and retry.`,
    );
  }
}
