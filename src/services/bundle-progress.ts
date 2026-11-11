import cliProgress from 'cli-progress';
import { formatTransfer } from '../utils/progress.js';
import type { DownloadProgress, ExtractionProgress } from './installer/models.js';

export class BundleProgress {

  private downloadBar?: cliProgress.SingleBar;
  private extractionBar?: cliProgress.SingleBar;

  public download({ downloaded, total }: DownloadProgress): void {
    if (total <= 0) {
      return;
    }

    if (!this.downloadBar) {
      this.downloadBar = new cliProgress.SingleBar(
        { format: '  [{bar}] {percentage}% | {bytes}', hideCursor: true },
        cliProgress.Presets.shades_classic,
      );
      this.downloadBar.start(total, downloaded, { bytes: formatTransfer(downloaded, total) });
    } else {
      this.downloadBar.update(Math.min(downloaded, total), { bytes: formatTransfer(downloaded, total) });
    }
  }

  public extraction({ extracted, total }: ExtractionProgress): void {
    if (!this.extractionBar) {
      this.extractionBar = new cliProgress.SingleBar(
        { format: '  [{bar}] {percentage}% | {value}/{total} files', hideCursor: true },
        cliProgress.Presets.shades_classic,
      );
      this.extractionBar.start(total, extracted);
    } else {
      this.extractionBar.update(extracted);
    }
  }

  public finishDownload(): void {
    this.downloadBar?.stop();
    this.downloadBar = undefined;
  }

  public finishExtraction(): void {
    this.extractionBar?.stop();
  }

  public close(): void {
    this.downloadBar?.stop();
    this.extractionBar?.stop();
  }
}
