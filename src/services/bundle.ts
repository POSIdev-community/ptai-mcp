import fs from 'node:fs';
import cliProgress from 'cli-progress';
import { logger as log } from '../utils/logger.js';
import { downloadBundle, unpackBundle } from '../utils/downloader.js';
import { getDownloadSecurityOptions } from '../utils/downloadSecurity.js';
import { formatTransfer } from '../utils/progress.js';
import { killAnalyzerProcesses } from '../utils/processes.js';
import { getBundleDir } from '../utils/paths.js';

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
    await killAnalyzerProcesses();

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

    if (process.platform !== 'darwin') fs.rmSync(downloadResult.archivePath, { force: true });
    log.success(successMessage);
  } finally {
    progressBar?.stop();
    extractionBar?.stop();
    process.removeListener('SIGINT', onSigint);
  }
}
