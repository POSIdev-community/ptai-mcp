import fs from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AieApi } from '../../../src/aie/api/client.js';
import { AIE_INSECURE_TLS_ORIGINS_ENV, aieRequest } from '../../../src/aie/api/transport.js';

const approved = 'https://aie.example';

beforeEach(() => {
  vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AIE TLS origin policy', () => {
  it('keeps the ordinary fetch implementation by default', () => {
    const request = vi.fn<typeof fetch>();
    expect(aieRequest(approved, request)).toBe(request);
  });
  it('matches normalized HTTPS origins without applying a wildcard or port inheritance', () => {
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, ' https://AIE.example:443/, https://other.example:8443 ');
    const request = vi.fn<typeof fetch>();
    expect(aieRequest(approved, request)).not.toBe(request);
    expect(aieRequest('https://other.example:8443', request)).not.toBe(request);
    expect(aieRequest('https://other.example', request)).toBe(request);
    expect(aieRequest('https://aie.example:8443', request)).toBe(request);
    expect(aieRequest('https://sub.aie.example', request)).toBe(request);
  });
  it.each([
    'http://aie.example',
    'https://*.example',
    'https://aie.example/path',
    'https://aie.example?secret=value',
    'https://aie.example#fragment',
    'https://user:password@aie.example',
    'not a URL',
  ])('rejects malformed opt-in configuration %s without echoing it', (value) => {
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, value);
    expect(() => aieRequest(approved)).toThrow(expect.objectContaining({ code: 'AIE_VALIDATION_ERROR' }));
    expect(() => aieRequest(approved)).not.toThrow('password');
  });
  it('binds the dispatcher to one origin and forces rejection of redirects', async () => {
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, approved);
    const request = vi.fn<typeof fetch>(async () => new Response('ok'));
    const transport = aieRequest(approved, request);
    await transport(`${approved}/api/test`, { redirect: 'follow' });
    expect(request).toHaveBeenCalledWith(`${approved}/api/test`, expect.objectContaining({ redirect: 'error' }));
    await expect(transport('https://other.example/api/test')).rejects.toMatchObject({ code: 'AIE_VALIDATION_ERROR' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('AIE TLS over real HTTPS', () => {
  const tls = {
    key: fs.readFileSync(new URL('../../fixtures/tls/localhost-key.pem', import.meta.url)),
    cert: fs.readFileSync(new URL('../../fixtures/tls/localhost-cert.pem', import.meta.url)),
  };
  let origin: string;
  let otherOrigin: string;
  let mode: 'normal' | 'redirect' | 'slow' = 'normal';
  let observed: Array<{ method?: string; authorization?: string; body: string }> = [];
  let redirected = 0;
  const server = https.createServer(tls, async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    observed.push({
      method: req.method,
      authorization: req.headers.authorization,
      body: Buffer.concat(chunks).toString(),
    });
    if (mode === 'redirect') {
      res.writeHead(302, { location: `${otherOrigin}/redirected` }).end();
    } else if (mode === 'slow') {
      res.writeHead(200, { 'content-type': 'application/json' }).write('"6.4.');
    } else if (req.method === 'POST') {
      res.writeHead(204).end();
    } else {
      res.writeHead(200, { 'content-type': 'application/json' }).end('"6.4.0"');
    }
  });
  const other = https.createServer(tls, (_req, res) => {
    redirected++;
    res.end('unexpected');
  });
  beforeAll(async () => {
    await Promise.all([server, other].map((s) => new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve))));
    origin = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
    otherOrigin = `https://127.0.0.1:${(other.address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    mode = 'normal';
    observed = [];
    redirected = 0;
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '1');
  });
  afterAll(async () => {
    for (const s of [server, other]) {
      s.closeAllConnections();
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });
  it('rejects an untrusted certificate and does not silently retry insecurely', async () => {
    const api = new AieApi(origin);
    await expect(api.json(api.version.apiVersionsPackageCurrentGetRaw())).rejects.toMatchObject({
      code: 'AIE_TLS_ERROR',
    });
    expect(observed).toHaveLength(0);
  });
  it('does not apply the installer bypass to AIE', async () => {
    vi.stubEnv('PTAI_MCP_ALLOW_INSECURE_TLS', '1');
    const api = new AieApi(origin);
    await expect(api.json(api.version.apiVersionsPackageCurrentGetRaw())).rejects.toMatchObject({
      code: 'AIE_TLS_ERROR',
    });
  });
  it('connects only to the approved origin and retains the policy in scoped clients', async () => {
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, origin);
    const api = new AieApi(origin, 'synthetic-token').scoped(new AbortController().signal);
    expect(await api.json(api.version.apiVersionsPackageCurrentGetRaw())).toBe('6.4.0');
    expect(observed[0].authorization).toBe('Bearer synthetic-token');
    const denied = new AieApi(otherOrigin);
    await expect(denied.json(denied.version.apiVersionsPackageCurrentGetRaw())).rejects.toMatchObject({
      code: 'AIE_TLS_ERROR',
    });
    expect(redirected).toBe(0);
  });
  it('does not contaminate the normal transport after opt-in is removed', async () => {
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, origin);
    const enabled = new AieApi(origin);
    await enabled.json(enabled.version.apiVersionsPackageCurrentGetRaw());
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, '');
    const disabled = new AieApi(origin);
    await expect(disabled.json(disabled.version.apiVersionsPackageCurrentGetRaw())).rejects.toMatchObject({
      code: 'AIE_TLS_ERROR',
    });
    expect(observed).toHaveLength(1);
  });
  it('never forwards credentials through a redirect to another origin', async () => {
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, origin);
    mode = 'redirect';
    const api = new AieApi(origin, 'synthetic-token');
    await expect(api.json(api.version.apiVersionsPackageCurrentGetRaw())).rejects.toMatchObject({
      code: 'AIE_NETWORK_ERROR',
    });
    expect(redirected).toBe(0);
    expect(observed).toHaveLength(1);
  });
  it('preserves streamed uploads, their headers and a no-content response', async () => {
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, origin);
    const api = new AieApi(origin, 'synthetic-token');
    const body = Readable.from(['archive-part-one', 'archive-part-two']);
    const options: RequestInit & { duplex: 'half' } = { body: body as unknown as BodyInit, duplex: 'half' };
    await api.empty(
      api.store.apiStoreProjectIdBranchesBranchIdSourcesPostRaw(
        {
          projectId: 'fixture-project',
          branchId: 'fixture-branch',
          archived: true,
        },
        options,
      ),
    );
    expect(observed).toEqual([
      { method: 'POST', authorization: 'Bearer synthetic-token', body: 'archive-part-onearchive-part-two' },
    ]);
  });
  it('cancels response-body reads without waiting for the server to finish', async () => {
    vi.stubEnv(AIE_INSECURE_TLS_ORIGINS_ENV, origin);
    mode = 'slow';
    const controller = new AbortController();
    const api = new AieApi(origin).scoped(controller.signal);
    const pending = api.json(api.version.apiVersionsPackageCurrentGetRaw());
    const rejected = expect(pending).rejects.toMatchObject({ code: 'AIE_CANCELLED' });
    await vi.waitFor(() => expect(observed).toHaveLength(1));
    controller.abort();
    await rejected;
  });
});
