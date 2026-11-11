import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { HttpHeader, HttpMethod } from '../../shared/http-constants.js';
import { RedirectPolicy, WriteMode } from '../../shared/io-constants.js';
import { getBundleExtension, getExpectedBundleVersion } from '../../utils/paths.js';
import { INSTALLER_PRODUCT_ID } from '../bundle-constants.js';
import { INTERMEDIATE_DOMAIN, PRODUCTION_DOMAIN, TEST_DOMAIN } from './constants.js';
import { getFileSize, writeResponseToFile } from './download-file.js';
import { type DownloadOptions, type RequestFunction } from './models.js';
import { createInsecureRequest, isNetworkConnectivityError, isTlsCertificateError } from './transport.js';

const MAX_ATTEMPTS = 3;

export function getInstallerUrl(version = getInstallerVersion(), domain = PRODUCTION_DOMAIN): string {
  const extension = getBundleExtension();
  const numericVersion = version.split('-')[0];

  return `https://${domain}/api/v6/products/${INSTALLER_PRODUCT_ID}.${extension}/${numericVersion}/download/${INSTALLER_PRODUCT_ID}.${version}.${extension}`;
}

export function getInstallerArchivePath(version = getInstallerVersion()): string {
  return path.join(os.homedir(), `${INSTALLER_PRODUCT_ID}.${version}.${getBundleExtension()}`);
}

export async function findInstallerUrl(
  version = getInstallerVersion(),
  signal?: AbortSignal,
  requestFn: RequestFunction = fetch,
  security: Pick<DownloadOptions, 'allowInsecureTls' | 'confirmInsecureTls' | 'insecureRequest'> = {},
): Promise<string> {
  return (await selectInstallerUrl(version, signal, requestFn, security)).url;
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

      if (options.signal?.aborted || attempt === MAX_ATTEMPTS) {
        break;
      }

      await delay(1000);
    }
  }

  if (options.signal?.aborted) {
    throw lastError;
  }

  if (isNetworkConnectivityError(lastError)) {
    throw new Error(
      'The connection was interrupted while downloading the analyzer bundle. Check your network and retry.',
      {
        cause: lastError,
      },
    );
  }

  throw lastError;
}

function getInstallerVersion(version = getExpectedBundleVersion()): string {
  if (!version) {
    throw new Error('Bundle version is not configured in package.json.');
  }

  return version;
}

async function requestHead(
  url: string,
  signal?: AbortSignal,
  requestFn: RequestFunction = fetch,
): Promise<HeadResponse> {
  const response = await requestFn(url, { method: HttpMethod.Head, signal, redirect: RedirectPolicy.Follow });

  return {
    statusCode: response.status,
    contentLength: Number.parseInt(response.headers.get(HttpHeader.ContentLength) ?? '0', 10) || 0,
  };
}

async function selectInstallerUrl(
  version: string,
  signal: AbortSignal | undefined,
  requestFn: RequestFunction,
  security: Pick<DownloadOptions, 'allowInsecureTls' | 'confirmInsecureTls' | 'insecureRequest'>,
): Promise<InstallerSelection> {
  const candidates = [
    getInstallerUrl(version, PRODUCTION_DOMAIN),
    getInstallerUrl(version, INTERMEDIATE_DOMAIN),
    getInstallerUrl(version, TEST_DOMAIN),
  ];

  const trusted = await probeInstallerEndpoints(candidates, signal, requestFn);

  if (trusted.selection) {
    return trusted.selection;
  }

  let lastError = trusted.lastError;

  if (trusted.hadCertError) {
    const allowed =
      security.allowInsecureTls === true ||
      (security.confirmInsecureTls ? await security.confirmInsecureTls(candidates[0], lastError) : false);

    if (!allowed) {
      throw new Error(
        'The installer endpoints use untrusted TLS certificates. Certificate verification was not disabled, so the download was cancelled.',
        { cause: lastError },
      );
    }

    const insecure = await probeInstallerEndpoints(
      candidates,
      signal,
      security.insecureRequest ?? createInsecureRequest(),
    );

    if (insecure.selection) {
      return insecure.selection;
    }

    lastError = insecure.lastError;
  }

  throw new Error('No installer endpoint is currently reachable. Check your network connection and retry.', {
    cause: lastError,
  });
}

async function probeInstallerEndpoints(
  candidates: string[],
  signal: AbortSignal | undefined,
  request: RequestFunction,
): Promise<{ selection?: InstallerSelection; lastError?: unknown; hadCertError: boolean }> {
  let lastError: unknown;
  let hadCertError = false;

  for (const candidate of candidates) {
    try {
      const response = await requestHead(candidate, signal, request);

      if (response.statusCode >= 200 && response.statusCode < 400) {
        return { selection: { url: candidate, request }, hadCertError };
      }

      lastError = new Error(`Installer endpoint returned HTTP ${response.statusCode}: ${candidate}`);
    } catch (error) {
      lastError = error;
      hadCertError = hadCertError || isTlsCertificateError(error);
    }
  }

  return { lastError, hadCertError };
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
    method: HttpMethod.Get,
    headers,
    signal: options.signal,
    redirect: RedirectPolicy.Follow,
  });

  if (!response.ok) {
    throw new Error(`Installer download failed with HTTP ${response.status}.`);
  }

  const resumed = requestedOffset > 0 && response.status === 206;
  const initialDownloaded = resumed ? requestedOffset : 0;
  const total =
    head.contentLength > 0
      ? head.contentLength
      : (Number.parseInt(response.headers.get(HttpHeader.ContentLength) ?? '0', 10) || 0) + initialDownloaded;

  await writeResponseToFile(
    response,
    archivePath,
    resumed ? WriteMode.Append : WriteMode.Overwrite,
    initialDownloaded,
    total,
    options,
  );

  if (head.contentLength > 0) {
    const finalSize = await getFileSize(archivePath);

    if (finalSize !== head.contentLength) {
      throw new Error(`Downloaded installer size mismatch: expected ${head.contentLength}, got ${finalSize}.`);
    }
  }
}

interface HeadResponse {
  statusCode: number;
  contentLength: number;
}

interface InstallerSelection {
  url: string;
  request: RequestFunction;
}
