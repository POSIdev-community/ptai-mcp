import type { IncomingMessage } from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { HttpMethod } from '../../shared/http-constants.js';
import { RedirectPolicy } from '../../shared/io-constants.js';
import { DOWNLOAD_ABORTED_MESSAGE, INTERMEDIATE_DOMAIN, PRODUCTION_DOMAIN, TEST_DOMAIN } from './constants.js';
import { type RequestFunction } from './models.js';

const MAX_REDIRECTS = 5;

const ALLOWED_TLS_DOMAINS = new Set([PRODUCTION_DOMAIN, INTERMEDIATE_DOMAIN, TEST_DOMAIN]);

const TLS_CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

export function isTlsCertificateError(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const code = 'code' in current ? String(current.code) : undefined;

    if (code && TLS_CERTIFICATE_ERROR_CODES.has(code)) {
      return true;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}

export function createInsecureRequest(request: typeof https.request = https.request): RequestFunction {
  return async (input, init = {}) => {
    const initialUrl = toUrl(input);

    if (initialUrl.protocol !== 'https:' || !ALLOWED_TLS_DOMAINS.has(initialUrl.hostname)) {
      throw new Error(`Insecure TLS is restricted to allowed domains.`);
    }

    return requestWithRedirects(initialUrl, init, request, 0);
  };
}

export function isNetworkConnectivityError(error: unknown): boolean {
  const networkCodes = new Set([
    'EAI_AGAIN',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENETDOWN',
    'ENETUNREACH',
    'ENOTFOUND',
    'ETIMEDOUT',
  ]);

  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);

    if ('code' in current && networkCodes.has(String(current.code))) {
      return true;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}

async function requestWithRedirects(
  url: URL,
  init: RequestInit,
  request: typeof https.request,
  redirectCount: number,
): Promise<Response> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error('Too many installer download redirects.');
  }

  if (init.signal?.aborted) {
    throw new Error(DOWNLOAD_ABORTED_MESSAGE);
  }

  return new Promise<Response>((resolve, reject) => {
    const method = init.method ?? HttpMethod.Get;
    const req = request(
      url,
      {
        method,
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        rejectUnauthorized: false,
      },
      (response) => {
        void followDownloadResponse(response, url, init, request, redirectCount).then(resolve, reject);
      },
    );

    const onAbort = () => req.destroy(new Error(DOWNLOAD_ABORTED_MESSAGE));

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
  if (input instanceof URL) {
    return input;
  }

  if (typeof input === 'string') {
    return new URL(input);
  }

  return new URL(input.url);
}

async function followDownloadResponse(
  response: IncomingMessage,
  url: URL,
  init: RequestInit,
  request: typeof https.request,
  redirectCount: number,
): Promise<Response> {
  const status = response.statusCode ?? 500;
  const location = response.headers.location;

  if (status >= 300 && status < 400 && location && init.redirect === RedirectPolicy.Follow) {
    response.resume();
    const redirectUrl = new URL(location, url);

    if (redirectUrl.protocol !== 'https:' || !ALLOWED_TLS_DOMAINS.has(redirectUrl.hostname)) {
      throw new Error(`Refusing insecure TLS redirect outside allowed domains.`);
    }

    return requestWithRedirects(redirectUrl, init, request, redirectCount + 1);
  }

  return downloadResponse(response, init.method ?? HttpMethod.Get);
}

function downloadResponse(response: IncomingMessage, method: string): Response {
  const status = response.statusCode ?? 500;
  const headers = new Headers();

  for (const [name, value] of Object.entries(response.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value !== undefined) {
      headers.append(name, String(value));
    }
  }

  if (method === HttpMethod.Head) {
    response.resume();

    return new Response(null, { status, statusText: response.statusMessage, headers });
  }

  const body = Readable.toWeb(response) as ReadableStream<Uint8Array>;

  return new Response(body, { status, statusText: response.statusMessage, headers });
}
