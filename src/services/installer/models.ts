import { spawn } from 'node:child_process';

export interface DownloadProgress {
  downloaded: number;
  total: number;
}

export interface ExtractionProgress {
  extracted: number;
  total: number;
}

export interface DownloadOptions {
  version?: string;
  /** Optional URL override used by tests and local mirrors. */
  url?: string;
  outputPath?: string;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
  request?: RequestFunction;
  allowInsecureTls?: boolean;
  confirmInsecureTls?: (url: string, error: unknown) => Promise<boolean>;
  /** Request implementation used after explicit insecure-TLS approval. Primarily useful for tests. */
  insecureRequest?: RequestFunction;
}

export type DownloadSecurityOptions = Pick<
  DownloadOptions,
  'allowInsecureTls' | 'confirmInsecureTls' | 'insecureRequest'
>;

export type DownloadTlsOptions = Pick<DownloadSecurityOptions, 'allowInsecureTls' | 'confirmInsecureTls'>;

export type RequestFunction = typeof fetch;

export type BundleRunner = (
  file: string,
  args?: readonly string[],
  options?: { windowsHide?: boolean },
) => Promise<unknown>;

export type ExtractionProgressHandler = (progress: ExtractionProgress) => void;

export type BundleProcessSpawner = typeof spawn;
