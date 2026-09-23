import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getBundleDir, getBundleExtension, getExpectedBundleVersion } from './paths.js';

const execFileAsync = promisify(execFile);
const PRODUCTION_DOMAIN = 'update.ptsecurity.com';
const TEST_DOMAIN = 'flus-test.ptsecurity.ru';
const MAX_ATTEMPTS = 3;

export interface DownloadProgress {
  downloaded: number;
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
}

export type RequestFunction = typeof fetch;

export type BundleRunner = (
  file: string,
  args?: readonly string[],
  options?: { windowsHide?: boolean },
) => Promise<unknown>;

interface HeadResponse {
  statusCode: number;
  contentLength: number;
}

function getInstallerVersion(version = getExpectedBundleVersion()): string {
  if (!version) {
    throw new Error('Bundle version is not configured in package.json.');
  }
  return version;
}

export function getInstallerUrl(version = getInstallerVersion(), domain = PRODUCTION_DOMAIN): string {
  const extension = getBundleExtension();
  const numericVersion = version.split('-')[0];
  return `https://${domain}/api/v6/products/AI.INFRASTRUCTURE.INSTALLATOR.${extension}/${numericVersion}/download/AI.INFRASTRUCTURE.INSTALLATOR.${version}.${extension}`;
}

export function getInstallerArchivePath(version = getInstallerVersion()): string {
  return path.join(os.homedir(), `AI.INFRASTRUCTURE.INSTALLATOR.${version}.${getBundleExtension()}`);
}

async function requestHead(
  url: string,
  signal?: AbortSignal,
  requestFn: RequestFunction = fetch,
): Promise<HeadResponse> {
  const response = await requestFn(url, { method: 'HEAD', signal, redirect: 'follow' });
  return {
    statusCode: response.status,
    contentLength: Number.parseInt(response.headers.get('content-length') ?? '0', 10) || 0,
  };
}

export async function findInstallerUrl(
  version = getInstallerVersion(),
  signal?: AbortSignal,
  requestFn: RequestFunction = fetch,
): Promise<string> {
  const candidates = [getInstallerUrl(version, PRODUCTION_DOMAIN), getInstallerUrl(version, TEST_DOMAIN)];

  for (const candidate of candidates) {
    try {
      const response = await requestHead(candidate, signal, requestFn);
      if (response.statusCode >= 200 && response.statusCode < 400) {
        return candidate;
      }
    } catch {
      // Try the fallback endpoint.
    }
  }

  throw new Error('Neither production nor test installer URL is available.');
}

export async function downloadBundle(options: DownloadOptions = {}): Promise<{
  archivePath: string;
  url: string;
}> {
  const version = getInstallerVersion(options.version);
  const archivePath = options.outputPath ?? getInstallerArchivePath(version);
  const url = options.url ?? (await findInstallerUrl(version, options.signal, options.request));
  await fsp.mkdir(path.dirname(archivePath), { recursive: true });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await downloadOnce(url, archivePath, options);
      return { archivePath, url };
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || attempt === MAX_ATTEMPTS) break;
      await delay(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function downloadOnce(url: string, archivePath: string, options: DownloadOptions): Promise<void> {
  const requestFn = options.request ?? fetch;
  const head = await requestHead(url, options.signal, requestFn);
  if (head.statusCode < 200 || head.statusCode >= 300) {
    throw new Error(`Installer download failed with HTTP ${head.statusCode}.`);
  }

  const existingSize = await getFileSize(archivePath);
  if (head.contentLength > 0 && existingSize === head.contentLength) {
    options.onProgress?.({ downloaded: existingSize, total: head.contentLength });
    return;
  }

  const requestedOffset = head.contentLength > 0 && existingSize < head.contentLength ? existingSize : 0;

  const headers: Record<string, string> = requestedOffset > 0 ? { Range: `bytes=${requestedOffset}-` } : {};

  const response = await requestFn(url, {
    method: 'GET',
    headers,
    signal: options.signal,
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Installer download failed with HTTP ${response.status}.`);
  }

  const resumed = requestedOffset > 0 && response.status === 206;
  const initialDownloaded = resumed ? requestedOffset : 0;
  const total =
    head.contentLength > 0
      ? head.contentLength
      : (Number.parseInt(response.headers.get('content-length') ?? '0', 10) || 0) + initialDownloaded;

  await writeResponseToFile(response, archivePath, resumed ? 'a' : 'w', initialDownloaded, total, options);

  if (head.contentLength > 0) {
    const finalSize = await getFileSize(archivePath);
    if (finalSize !== head.contentLength) {
      throw new Error(`Downloaded installer size mismatch: expected ${head.contentLength}, got ${finalSize}.`);
    }
  }
}

export async function unpackBundle(
  archivePath: string,
  bundleDir = getBundleDir(),
  run: BundleRunner = execFileAsync as unknown as BundleRunner,
): Promise<void> {
  if (process.platform === 'darwin') {
    await run('open', [archivePath]);
    return;
  }

  await fsp.rm(bundleDir, { recursive: true, force: true });
  await fsp.mkdir(bundleDir, { recursive: true });

  if (process.platform === 'win32') {
    const quotePowerShell = (value: string) => `'${value.replaceAll("'", "''")}'`;
    const command = [
      'Expand-Archive',
      '-LiteralPath',
      quotePowerShell(archivePath),
      '-DestinationPath',
      quotePowerShell(bundleDir),
      '-Force',
    ].join(' ');
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true });
    return;
  }

  if (process.platform === 'linux') {
    await run('tar', ['-xzf', archivePath, '-C', bundleDir]);
    return;
  }

  throw new Error(`Unsupported OS: ${process.platform}`);
}

async function writeResponseToFile(
  response: Response,
  filePath: string,
  flags: 'a' | 'w',
  initialDownloaded: number,
  total: number,
  options: DownloadOptions,
): Promise<void> {
  if (!response.body) throw new Error('Response body is empty');

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(filePath, { flags });
    let downloaded = initialDownloaded;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      output.destroy();
      reject(error);
    };

    const abort = () => {
      fail(new Error('Installer download aborted.'));
    };

    if (options.signal?.aborted) {
      abort();
      return;
    }
    options.signal?.addEventListener('abort', abort, { once: true });

    const bodyStream =
      typeof (response.body as unknown as NodeJS.ReadableStream).on === 'function'
        ? (response.body as unknown as NodeJS.ReadableStream)
        : Readable.fromWeb(response.body as unknown as import('stream/web').ReadableStream);

    bodyStream.on('data', (chunk: Buffer | Uint8Array) => {
      downloaded += chunk.length;
      options.onProgress?.({ downloaded, total });
    });
    bodyStream.on('error', fail);
    output.on('error', fail);
    output.on('finish', () => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      resolve();
    });
    bodyStream.pipe(output);
  });
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fsp.stat(filePath);
    return stats.isFile() ? stats.size : 0;
  } catch {
    return 0;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
