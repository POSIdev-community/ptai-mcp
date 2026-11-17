import { describe, expect, it, vi } from 'vitest';
import { AieApi } from '../../../src/aie/api/client.js';
import { networkError } from '../../../src/aie/api/http-errors.js';
import { safeError } from '../../../src/shared/errors.js';

describe('TLS diagnostics', () => {
  it.each([
    ['CERT_HAS_EXPIRED', 'expired'],
    ['CERT_NOT_YET_VALID', 'not valid yet'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'hostname'],
    ['DEPTH_ZERO_SELF_SIGNED_CERT', 'self-signed'],
    ['SELF_SIGNED_CERT_IN_CHAIN', 'self-signed'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'chain'],
    ['UNABLE_TO_GET_ISSUER_CERT', 'issuer'],
    ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'issuer'],
  ])('explains %s without exposing raw certificate or exception data', (code, explanation) => {
    const cause = new Error('private certificate and authorization-code', {
      cause: new TypeError('private-url?token=secret', { cause: { code, cert: 'private certificate' } }),
    });
    const error = safeError(networkError(cause, true, 'https://aie.example:8443'), 'aie_auth');
    expect(error).toMatchObject({
      code: 'AIE_TLS_ERROR',
      message: expect.stringContaining(explanation),
      effects: 'unknown',
      retryable: false,
      next_action: expect.stringContaining('explicit approval'),
      tls: {
        node_code: code,
        server_url: 'https://aie.example:8443',
        trusted_ca_env: 'NODE_EXTRA_CA_CERTS',
        insecure_tls_example: { env: { PTAI_MCP_AIE_INSECURE_TLS_ORIGINS: 'https://aie.example:8443' } },
        insecure_tls_requires_approval: true,
        restart_required: true,
      },
    });
    expect(error.next_action).toContain('Verify the target state');
    expect(JSON.stringify(error)).not.toMatch(/private|secret|authorization-code/);
  });

  it('does not recommend disabling certificate verification for TLS protocol errors', () => {
    const error = networkError({ code: 'ERR_SSL_WRONG_VERSION_NUMBER' }, false, 'https://aie.example');
    expect(error.code).toBe('AIE_TLS_ERROR');
    expect(error.details.next_action).toContain('TLS versions');
    expect(error.details.tls?.insecure_tls_example).toBeUndefined();
    expect(error.details.next_action).not.toContain('PTAI_MCP_AIE_INSECURE_TLS_ORIGINS');
  });

  it('binds the example to the actual AIE origin through the generated request', async () => {
    const request = vi.fn(async () => {
      throw new TypeError('fetch failed', { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } });
    });
    const api = new AieApi('https://aie.example:8443', 'synthetic-token', request);
    await expect(api.json(api.version.apiVersionsPackageCurrentGetRaw())).rejects.toMatchObject({
      details: { tls: { server_url: 'https://aie.example:8443' }, effects: 'not_applied', retryable: false },
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['https://user:secret@aie.example', 'https://aie.example/?token=secret', undefined])(
    'omits unsafe or missing origins: %s',
    (origin) => {
      const error = networkError({ code: 'CERT_HAS_EXPIRED' }, false, origin);
      expect(error.details.tls?.server_url).toBeUndefined();
      expect(error.details.tls?.insecure_tls_example).toBeUndefined();
      expect(JSON.stringify(error)).not.toContain('secret');
    },
  );

  it('bounds cyclic cause chains and leaves non-TLS network failures unchanged', () => {
    const cause: { cause?: unknown } = {};
    cause.cause = cause;
    expect(networkError(cause, false).code).toBe('AIE_NETWORK_ERROR');
    expect(networkError({ code: 'CERT_HAS_EXPIRED secret' }, false).code).toBe('AIE_NETWORK_ERROR');
    expect(networkError(new DOMException('private', 'AbortError'), true).code).toBe('AIE_CANCELLED');
  });
});
