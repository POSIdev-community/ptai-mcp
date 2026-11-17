import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import { serverUrl } from './server-url.js';
import { AIE_INSECURE_TLS_ORIGINS_ENV } from './transport.js';

const certificateFailures = new Map([
  ['CERT_HAS_EXPIRED', 'The server certificate has expired.'],
  ['CERT_NOT_YET_VALID', 'The server certificate is not valid yet. Check the certificate and system clock.'],
  ['ERR_TLS_CERT_ALTNAME_INVALID', 'The certificate does not match the server hostname. Check the server URL.'],
  ['DEPTH_ZERO_SELF_SIGNED_CERT', 'The server uses a self-signed certificate that Node does not trust.'],
  ['SELF_SIGNED_CERT_IN_CHAIN', 'The certificate chain contains a self-signed certificate that Node does not trust.'],
  ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'Node could not verify the server certificate chain.'],
  ['UNABLE_TO_GET_ISSUER_CERT', 'Node could not find the certificate issuer.'],
  ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'Node could not find a trusted certificate issuer.'],
]);

export function tlsError(error: unknown, changing: boolean, origin?: string): ToolError | undefined {
  const code = tlsCode(error);

  if (!code) {
    return undefined;
  }

  const server = safeOrigin(origin);
  const certificate = certificateFailures.has(code);
  const reason = certificateFailures.get(code) ?? 'The TLS connection failed. Check the server TLS configuration.';

  return new ToolError(ErrorCode.TlsError, reason, {
    effects: changing ? Effects.Unknown : Effects.NotApplied,
    retryable: false,
    next_action:
      recoveryAction(certificate) +
      (changing ? 'Verify the target state before repeating a change.' : 'Repeat the read after fixing TLS.'),
    tls: {
      node_code: code,
      server_url: server,
      ...(certificate
        ? {
            trusted_ca_env: 'NODE_EXTRA_CA_CERTS',
            insecure_tls_env: AIE_INSECURE_TLS_ORIGINS_ENV,
            insecure_tls_example: server ? { env: { [AIE_INSECURE_TLS_ORIGINS_ENV]: server } } : undefined,
            insecure_tls_requires_approval: true,
            restart_required: true,
          }
        : {}),
    },
  });
}

function recoveryAction(certificate: boolean): string {
  if (!certificate) {
    return 'Check the HTTPS endpoint, proxy configuration, and TLS versions supported by the server and Node. ';
  }

  return (
    'Fix the reported certificate problem. For a corporate CA, set NODE_EXTRA_CA_CERTS to a trusted PEM file ' +
    'in the MCP launch environment. For a development server, ask for explicit approval before disabling certificate ' +
    `verification for its exact origin with ${AIE_INSECURE_TLS_ORIGINS_ENV}. ` +
    'Restart or reconnect MCP after changing its environment. If sign-in failed, start a new login with a new code. '
  );
}

function tlsCode(error: unknown): string | undefined {
  const visited = new Set<unknown>();
  let cause = error;

  while (cause && typeof cause === 'object' && !visited.has(cause) && visited.size < 8) {
    visited.add(cause);
    const value = cause as { code?: unknown; cause?: unknown };

    if (
      typeof value.code === 'string' &&
      /^[A-Z0-9_]{1,80}$/.test(value.code) &&
      /CERT|TLS|SSL|UNABLE_TO_VERIFY/.test(value.code)
    ) {
      return value.code;
    }

    cause = value.cause;
  }

  return undefined;
}

function safeOrigin(origin?: string): string | undefined {
  try {
    return origin ? serverUrl(origin) : undefined;
  } catch {
    return undefined;
  }
}
