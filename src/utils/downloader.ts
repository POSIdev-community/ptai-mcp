import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getBundleDir, getBundleExtension, getExpectedBundleVersion } from './paths.js';

const execFileAsync = promisify(execFile);
const PRODUCTION_DOMAIN = 'update.ptsecurity.com';
const TEST_DOMAIN = 'flus-test.ptsecurity.ru';
const MAX_ATTEMPTS = 3;
const MAX_REDIRECTS = 5;
const TLS_CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

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
  allowInsecureTestTls?: boolean;
  confirmInsecureTestTls?: (url: string, error: unknown) => Promise<boolean>;
  /** Request implementation used after explicit insecure-TLS approval. Primarily useful for tests. */
  insecureTestRequest?: RequestFunction;
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

interface InstallerSelection {
  url: string;
  request: RequestFunction;
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
  security: Pick<DownloadOptions, 'allowInsecureTestTls' | 'confirmInsecureTestTls' | 'insecureTestRequest'> = {},
): Promise<string> {
  return (await selectInstallerUrl(version, signal, requestFn, security)).url;
}

async function selectInstallerUrl(
  version: string,
  signal: AbortSignal | undefined,
  requestFn: RequestFunction,
  security: Pick<DownloadOptions, 'allowInsecureTestTls' | 'confirmInsecureTestTls' | 'insecureTestRequest'>,
): Promise<InstallerSelection> {
  const candidates = [getInstallerUrl(version, PRODUCTION_DOMAIN), getInstallerUrl(version, TEST_DOMAIN)];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const response = await requestHead(candidate, signal, requestFn);
      if (response.statusCode >= 200 && response.statusCode < 400) {
        return { url: candidate, request: requestFn };
      }
      lastError = new Error(`Installer endpoint returned HTTP ${response.statusCode}: ${candidate}`);
    } catch (error) {
      lastError = error;

      if (new URL(candidate).hostname !== TEST_DOMAIN || !isTlsCertificateError(error)) {
        continue;
      }

      const allowed =
        security.allowInsecureTestTls === true ||
        (security.confirmInsecureTestTls ? await security.confirmInsecureTestTls(candidate, error) : false);

      if (!allowed) {
        throw new Error(
          `The test installer endpoint uses an untrusted TLS certificate. ` +
            `Certificate verification was not disabled, so the download was cancelled.`,
          { cause: error },
        );
      }

      const insecureRequest = security.insecureTestRequest ?? createInsecureTestRequest();
      const insecureResponse = await requestHead(candidate, signal, insecureRequest);
      if (insecureResponse.statusCode >= 200 && insecureResponse.statusCode < 400) {
        return { url: candidate, request: insecureRequest };
      }
      lastError = new Error(`Installer endpoint returned HTTP ${insecureResponse.statusCode}: ${candidate}`);
    }
  }

  throw new Error('Neither production nor test installer URL is available.', { cause: lastError });
}

export async function downloadBundle(options: DownloadOptions = {}): Promise<{
  archivePath: string;
  url: string;
}> {
  const version = getInstallerVersion(options.version);
  const archivePath = options.outputPath ?? getInstallerArchivePath(version);
  const selection = options.url
    ? { url: options.url, request: options.request ?? fetch }
    : await selectInstallerUrl(version, options.signal, options.request ?? fetch, options);
  const { url } = selection;
  const downloadOptions = { ...options, request: selection.request };
  await fsp.mkdir(path.dirname(archivePath), { recursive: true });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await downloadOnce(url, archivePath, downloadOptions);
      return { archivePath, url };
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || attempt === MAX_ATTEMPTS) break;
      await delay(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function isTlsCertificateError(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const code = 'code' in current ? String(current.code) : undefined;
    if (code && TLS_CERTIFICATE_ERROR_CODES.has(code)) return true;
    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}

export function createInsecureTestRequest(request: typeof https.request = https.request): RequestFunction {
  return async (input, init = {}) => {
    const initialUrl = toUrl(input);
    if (initialUrl.protocol !== 'https:' || initialUrl.hostname !== TEST_DOMAIN) {
      throw new Error(`Insecure TLS is restricted to https://${TEST_DOMAIN}.`);
    }

    return requestWithRedirects(initialUrl, init, request, 0);
  };
}

async function requestWithRedirects(
  url: URL,
  init: RequestInit,
  request: typeof https.request,
  redirectCount: number,
): Promise<Response> {
  if (redirectCount > MAX_REDIRECTS) throw new Error('Too many installer download redirects.');

  return new Promise<Response>((resolve, reject) => {
    const method = init.method ?? 'GET';
    const req = request(
      url,
      {
        method,
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        rejectUnauthorized: false,
      },
      (response) => {
        const status = response.statusCode ?? 500;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location && init.redirect === 'follow') {
          response.resume();
          const redirectUrl = new URL(location, url);
          if (redirectUrl.protocol !== 'https:' || redirectUrl.hostname !== TEST_DOMAIN) {
            reject(new Error(`Refusing insecure TLS redirect outside https://${TEST_DOMAIN}.`));
            return;
          }
          void requestWithRedirects(redirectUrl, init, request, redirectCount + 1).then(resolve, reject);
          return;
        }

        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(name, item);
          } else if (value !== undefined) {
            headers.append(name, String(value));
          }
        }

        if (method === 'HEAD') {
          response.resume();
          resolve(new Response(null, { status, statusText: response.statusMessage, headers }));
          return;
        }

        const body = Readable.toWeb(response) as ReadableStream<Uint8Array>;
        resolve(new Response(body, { status, statusText: response.statusMessage, headers }));
      },
    );

    const onAbort = () => req.destroy(new Error('Installer download aborted.'));
    if (init.signal?.aborted) {
      onAbort();
      return;
    }
    init.signal?.addEventListener('abort', onAbort, { once: true });
    req.once('close', () => init.signal?.removeEventListener('abort', onAbort));
    req.once('error', reject);
    req.end();
  });
}

function toUrl(input: Parameters<RequestFunction>[0]): URL {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  return new URL(input.url);
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
