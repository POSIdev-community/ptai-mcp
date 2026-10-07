import fs from 'node:fs';
import cliProgress from 'cli-progress';
import { logger as log } from '../utils/logger.js';
import { downloadBundle, unpackBundle } from '../utils/downloader.js';
import { getDownloadSecurityOptions } from '../utils/downloadSecurity.js';
import { formatTransfer } from '../utils/progress.js';
import { killAnalyzerProcesses } from '../utils/processes.js';
import { getBundleDir, getProxyPath, readVersionsJson } from '../utils/paths.js';

export interface BundleOperationOptions {
  version: string;
  successMessage: string;
}

export async function runBundleOperation({ version, successMessage }: BundleOperationOptions): Promise<void> {
  const abortController = new AbortController();
  const onSigint = () => abortController.abort();
  process.once('SIGINT', onSigint);

  let progressBar: cliProgress.SingleBar | undefined;
  let extractionBar: cliProgress.SingleBar | undefined;

  try {
    log.step('Stopping analyzer processes...');
    const initialStop = await killAnalyzerProcesses();
    log.info(formatStopResult(initialStop));

    log.step('Downloading analyzer bundle...');
    const downloadResult = await downloadBundle({
      version,
      signal: abortController.signal,
      ...getDownloadSecurityOptions(),
      onProgress: ({ downloaded, total }) => {
        if (total <= 0) return;
        if (!progressBar) {
          progressBar = new cliProgress.SingleBar(
            { format: '  [{bar}] {percentage}% | {bytes}', hideCursor: true },
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

    // A host agent may restart the proxy while a multi-gigabyte bundle is downloading.
    // Re-check immediately before replacing files to avoid locked DLLs on Windows.
    log.step('Stopping analyzer processes before installation...');
    const finalStop = await killAnalyzerProcesses();
    log.info(formatStopResult(finalStop));

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

    if (process.platform === 'darwin') verifyMacInstallation(version);

    if (process.platform !== 'darwin') fs.rmSync(downloadResult.archivePath, { force: true });
    log.success(successMessage);
  } finally {
    progressBar?.stop();
    extractionBar?.stop();
    process.removeListener('SIGINT', onSigint);
  }
}

function formatStopResult(result: Awaited<ReturnType<typeof killAnalyzerProcesses>>): string {
  return result.stopped.length > 0
    ? `Stopped analyzer processes: ${result.stopped.join(', ')}.`
    : 'No running analyzer processes found.';
}

function verifyMacInstallation(expectedVersion: string): void {
  const currentVersion = readVersionsJson()?.['AI.INFRASTRUCTURE.INSTALLATOR'];
  if (!fs.existsSync(getProxyPath()) || currentVersion !== expectedVersion) {
    throw new Error(
      `The macOS installer closed before bundle ${expectedVersion} was installed. Complete the installation and retry.`,
    );
  }
}
