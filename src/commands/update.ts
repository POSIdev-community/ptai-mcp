import fs from 'node:fs';
import cliProgress from 'cli-progress';
import { logger as log } from '../utils/logger.js';
import { downloadBundle, unpackBundle } from '../utils/downloader.js';
import { getDownloadSecurityOptions } from '../utils/downloadSecurity.js';
import { killAnalyzerProcesses } from '../utils/processes.js';
import { getBundleDir, getExpectedBundleVersion, readVersionsJson } from '../utils/paths.js';

export async function updateCommand(): Promise<void> {
  const version = getExpectedBundleVersion();
  if (!version) throw new Error('Bundle version is not configured in package.json.');

  const current = readVersionsJson()?.['AI.INFRASTRUCTURE.INSTALLATOR'];
  log.info(`Updating analyzer bundle ${current ? `${current} → ` : ''}${version}`);

  const abortController = new AbortController();
  const onSigint = () => abortController.abort();
  process.once('SIGINT', onSigint);
  let bar: cliProgress.SingleBar | undefined;

  try {
    await killAnalyzerProcesses();
    const result = await downloadBundle({
      version,
      signal: abortController.signal,
      ...getDownloadSecurityOptions(),
      onProgress: ({ downloaded, total }) => {
        if (total <= 0) return;
        if (!bar) {
          bar = new cliProgress.SingleBar(
            {
              format: '  [{bar}] {percentage}% | {value}/{total} bytes',
              hideCursor: true,
            },
            cliProgress.Presets.shades_classic,
          );
          bar.start(total, downloaded);
        } else {
          bar.update(Math.min(downloaded, total));
        }
      },
    });
    bar?.stop();
    bar = undefined;
    await unpackBundle(result.archivePath, getBundleDir());
    if (process.platform !== 'darwin') fs.rmSync(result.archivePath, { force: true });
    log.success(`Bundle ${version} updated.`);
  } finally {
    bar?.stop();
    process.removeListener('SIGINT', onSigint);
  }
}
