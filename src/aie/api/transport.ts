import { Agent } from 'undici';
import { validation } from '../../shared/errors.js';
import { RedirectPolicy } from '../../shared/io-constants.js';
import { logger } from '../../utils/logger.js';
import { serverUrl } from './server-url.js';

export const AIE_INSECURE_TLS_ORIGINS_ENV = 'PTAI_MCP_AIE_INSECURE_TLS_ORIGINS';

let insecureDispatcher: Agent | undefined;

export function aieRequest(origin: string, request: typeof fetch = fetch): typeof fetch {
  const configured = process.env[AIE_INSECURE_TLS_ORIGINS_ENV] ?? '';
  const origins = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(allowedOrigin);

  if (!origins.includes(origin)) {
    return request;
  }

  const dispatcher = (insecureDispatcher ??= createInsecureDispatcher());

  return async (input, init) => {
    const url = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);

    if (url.origin !== origin) {
      validation('The AIE TLS transport does not permit requests to another origin.');
    }

    const options: RequestInit & { dispatcher: Agent } = { ...init, dispatcher, redirect: RedirectPolicy.Reject };

    return request(input, options);
  };
}

function allowedOrigin(value: string): string {
  try {
    const origin = serverUrl(value);

    if (!new URL(origin).hostname.includes('*')) {
      return origin;
    }
  } catch {
    // Do not echo malformed configuration: it may contain credentials.
  }

  return validation(
    `${AIE_INSECURE_TLS_ORIGINS_ENV} must contain comma-separated HTTPS origins without credentials, paths or wildcards.`,
  );
}

function createInsecureDispatcher(): Agent {
  logger.warn(
    `AIE TLS certificate verification is disabled for explicitly allowed origins via ${AIE_INSECURE_TLS_ORIGINS_ENV}.`,
  );

  return new Agent({ connect: { rejectUnauthorized: false }, maxRedirections: 0 });
}
