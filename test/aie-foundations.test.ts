import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { supportedVersion } from '../src/aie/version.js';
import { SessionCodec, sessionFingerprint } from '../src/aie/session-codec.js';
import { SessionStorage } from '../src/aie/session-storage.js';
import { Pages } from '../src/aie/pagination.js';
import { Operations } from '../src/aie/operations.js';
import { AieError, safeError } from '../src/aie/errors.js';
import { AieApi, boundedBody, serverUrl } from '../src/aie/api.js';
import {
  merge,
  validateWrite,
  verifyRevision,
  revision,
  checkReadback,
  writable,
  preserveReadExtras,
} from '../src/aie/schema.js';
import { matches } from '../src/aie/findings.js';
import { result } from '../src/aie/result.js';

const temporary: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(temporary.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('AIE compatibility and safe results', () => {
  it.each(['6.3.0', '6.3.12.1234', '6.4.0', '6.4.1-rc.2+build'])('accepts %s with the same API contract', (version) =>
    expect(supportedVersion(version)).toBe(version),
  );
  it.each(['6.30.0', '6.2.9', '6.5.0', '7.3.0'])('rejects unsupported %s', (version) =>
    expect(() => supportedVersion(version)).toThrow(expect.objectContaining({ code: 'AIE_VERSION_UNSUPPORTED' })),
  );
  it.each(['', 'unknown', '6.4', null, {}])('distinguishes unknown version %j', (version) =>
    expect(() => supportedVersion(version)).toThrow(expect.objectContaining({ code: 'AIE_VERSION_UNKNOWN' })),
  );
  it.each([
    'http://example.com',
    'https://user:password@example.com',
    'https://example.com/a',
    'https://example.com?secret=x',
    'bad',
  ])('rejects unsafe server origin %s', (value) => expect(() => serverUrl(value)).toThrow());
  it('normalizes an origin and preserves normal TLS', () =>
    expect(serverUrl('https://EXAMPLE.com/')).toBe('https://example.com'));
  it('never serializes an unknown exception or its credentials', () =>
    expect(JSON.stringify(safeError(new Error('token=secret'), 'test'))).not.toContain('secret'));
  it('limits the entire duplicated MCP envelope', () => {
    const response = result({ payload: 'x'.repeat(140_000) });
    expect(response.isError).toBe(true);
    expect(response.structuredContent).toMatchObject({ error: { code: 'AIE_RESULT_LIMIT' } });
  });
});

describe('BE4P shared session codec and storage', () => {
  const session = {
    AccessToken: 'synthetic-access',
    RefreshToken: 'synthetic-refresh',
    EnterpriseApiUri: 'https://example.com',
  };
  it('round trips the BE4P format and salts each write', () => {
    const codec = new SessionCodec('dev.user', 'HOST-01');
    expect(codec.decode(codec.encode(session))).toEqual(session);
    expect(codec.encode(session)).not.toBe(codec.encode(session));
    expect(() => new SessionCodec('other', 'HOST-01').decode(codec.encode(session))).toThrow();
    expect(() => codec.encode(session, Buffer.alloc(7))).toThrow();
  });
  it('matches independently generated .NET AES fixtures', async () => {
    const fixtures = JSON.parse(
      await fs.readFile(new URL('./fixtures/session-codec.json', import.meta.url), 'utf8'),
    ) as Array<{ user: string; machine: string; ciphertext: string }>;
    for (const fixture of fixtures) {
      const codec = new SessionCodec(fixture.user, fixture.machine);
      expect(codec.encode(session, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]))).toBe(fixture.ciphertext);
      expect(codec.decode(fixture.ciphertext)).toEqual(session);
    }
  });
  it('atomically preserves a newer shared record against a late writer/logout', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-session-'));
    temporary.push(root);
    const store = new SessionStorage(path.join(root, 'shared_variables'), new SessionCodec('dev.user', 'HOST-01'));
    expect(await store.read()).toBeNull();
    await store.write(session, sessionFingerprint(null));
    const old = sessionFingerprint(session);
    await store.write({ ...session, AccessToken: 'new-access' }, old);
    await expect(store.write(session, old)).rejects.toMatchObject({ code: 'AIE_CONTEXT_CHANGED' });
    await expect(store.clear(old)).rejects.toMatchObject({ code: 'AIE_CONTEXT_CHANGED' });
    expect((await store.read())?.AccessToken).toBe('new-access');
    await store.clear();
    expect(await store.read()).toBeNull();
  });
  it('reports unreadable records without replacing them', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-session-'));
    temporary.push(root);
    const file = path.join(root, 'shared_variables');
    await fs.writeFile(file, 'partial');
    await expect(new SessionStorage(file).read()).rejects.toMatchObject({ code: 'AIE_SESSION_UNREADABLE' });
    expect(await fs.readFile(file, 'utf8')).toBe('partial');
  });
});

describe('bounded snapshot pages and operation lifecycle', () => {
  it('binds immutable cursors to identity, tool, target and page size', async () => {
    const pages = new Pages();
    const load = vi.fn(async () => [1, 2, 3]);
    const first = await pages.list('user', 'tool', { project: 'a' }, { page_size: 1 }, load);
    const request = { page_size: 1, cursor: first.next_cursor! };
    const next = await pages.list('user', 'tool', { project: 'a' }, request, load);
    expect(next.items).toEqual([2]);
    expect((await pages.list('user', 'tool', { project: 'a' }, request, load)).items).toEqual([2]);
    expect(load).toHaveBeenCalledTimes(1);
    await expect(pages.list('other', 'tool', { project: 'a' }, request, load)).rejects.toMatchObject({
      code: 'AIE_CURSOR_INVALID',
    });
    await expect(pages.list('user', 'tool', { project: 'b' }, request, load)).rejects.toMatchObject({
      code: 'AIE_CURSOR_INVALID',
    });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 600_001);
    await expect(pages.list('user', 'tool', { project: 'a' }, request, load)).rejects.toMatchObject({
      code: 'AIE_CURSOR_INVALID',
    });
    await expect(pages.list('user', 'tool', {}, { page_size: 101 }, load)).rejects.toThrow();
  });
  it('retains terminal results and emits one completion independently of polling', async () => {
    const completed = vi.fn();
    const operations = new Operations(completed);
    const job = operations.start('identity', 'create', 'target', async (context) => {
      context.stage('creating');
      context.applied('created', { project_id: 'id' });
      return { saved: true };
    });
    await vi.waitFor(() => expect(operations.get('identity', job.operation_id).state).toBe('succeeded'));
    expect(operations.get('identity', job.operation_id).result).toEqual({ saved: true });
    expect(operations.get('identity', job.operation_id).known_ids).toEqual({ project_id: 'id' });
    expect(completed).toHaveBeenCalledTimes(1);
    expect(() => operations.get('other', job.operation_id)).toThrow(
      expect.objectContaining({ code: 'AIE_CONTEXT_CHANGED' }),
    );
    expect(() => operations.get('identity', 'lost')).toThrow(
      expect.objectContaining({ code: 'AIE_OPERATION_NOT_FOUND' }),
    );
    await operations.close();
  });
  it('reports cancellation with already applied stages and rejects incompatible writes', async () => {
    const operations = new Operations();
    let resume!: () => void;
    const waiting = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const job = operations.start('identity', 'upload', 'target', async (context) => {
      context.applied('uploaded');
      await waiting;
      context.check();
      return {};
    });
    await Promise.resolve();
    expect(() => operations.start('identity', 'other', 'target', async () => ({}))).toThrow(
      expect.objectContaining({ code: 'AIE_TARGET_BUSY' }),
    );
    expect(operations.cancel('identity', job.operation_id).state).toBe('cancelling');
    resume();
    await vi.waitFor(() => expect(operations.get('identity', job.operation_id).state).toBe('cancelled'));
    expect(operations.get('identity', job.operation_id).effects).toBe('partial');
    await operations.close();
  });
});

describe('write contract, merge and finding filters', () => {
  it('preserves newer nested server fields while rejecting unknown caller changes', () => {
    const current = {
      sourceType: 'Local',
      whiteBoxSettings: { patternMatchingEnabled: true, asintEnabled: true, searchForRaceConditionsEnabled: true },
    };
    const patch = { whiteBoxSettings: { patternMatchingEnabled: false } };
    const updated = merge(writable('ProjectSettingsUpdateModel', current), patch) as Record<string, unknown>;
    validateWrite('ProjectSettingsUpdateModel', updated);
    expect(preserveReadExtras('ProjectSettingsUpdateModel', current, updated, patch)).toEqual({
      whiteBoxSettings: { patternMatchingEnabled: false, asintEnabled: true, searchForRaceConditionsEnabled: true },
    });
    expect(() =>
      validateWrite('ProjectSettingsUpdateModel', merge(updated, { whiteBoxSettings: { arbitraryNewField: true } })),
    ).toThrow();
  });
  it('deep merges objects and replaces arrays without mutating the original', () => {
    const base = { nested: { a: 1, b: 2 }, list: [1, 2] };
    expect(merge(base, { nested: { a: 3 }, list: [4] })).toEqual({ nested: { a: 3, b: 2 }, list: [4] });
    expect(base.nested.a).toBe(1);
    expect(() => merge({}, JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow();
  });
  it('validates real Swagger write models, unknown fields, null and revisions', () => {
    validateWrite('PreferredAgentsSettingsModel', { preferredAgents: [], preferredAgentsOnly: false });
    expect(() => validateWrite('PreferredAgentsSettingsModel', { preferredAgentsOnly: null })).toThrow();
    expect(() => validateWrite('PreferredAgentsSettingsModel', { unexpected: true })).toThrow();
    expect(() => validateWrite('PMGroupUpsertModel', { name: 'group' })).toThrow();
    expect(revision({ b: 2, a: 1 })).toBe(revision({ a: 1, b: 2 }));
    expect(() => verifyRevision({ value: 2 }, revision({ value: 1 }))).toThrow(
      expect.objectContaining({ code: 'AIE_REVISION_CONFLICT' }),
    );
    expect(() => checkReadback({ value: 2 }, { value: 1 })).toThrow(
      expect.objectContaining({ details: { effects: 'applied', next_action: expect.any(String) } }),
    );
  });
  it('uses finding category, server isNew and UI counter as distinct filters', () => {
    const issue = {
      level: 'High' as const,
      issueType: 'Vulnerability' as never,
      type: 'SQL injection',
      isNew: false,
      counter: 42,
      sourceFile: 'src\\main.cs',
      approvalState: 'None' as const,
    };
    expect(matches(issue, { severity: ['High', 'Medium'], is_new: false, counter: 42, path: 'src/main' })).toBe(true);
    expect(matches(issue, { issue_type: ['SQL injection'] })).toBe(false);
    expect(matches(issue, { is_new: true })).toBe(false);
  });
});

it('retains one bounded snapshot across pages, inherits page size and reuses continuation tokens on retries', async () => {
  const pages = new Pages();
  const items = Array.from({ length: 200 }, (_, id) => ({ id, value: 'x'.repeat(100_000) }));
  const load = vi.fn(async () => items);
  const first = await pages.list('identity', 'list', {}, { page_size: 1 }, load);
  const second = await pages.list('identity', 'list', {}, { cursor: first.next_cursor! }, load);
  const repeated = await pages.list('identity', 'list', {}, { cursor: first.next_cursor! }, load);
  expect(second.items).toEqual([items[1]]);
  expect(repeated.next_cursor).toBe(second.next_cursor);
  const third = await pages.list('identity', 'list', {}, { cursor: second.next_cursor! }, load);
  expect(third.items).toEqual([items[2]]);
  expect(load).toHaveBeenCalledOnce();
});

describe('generated API transport safety', () => {
  it('refreshes a rejected read once but never automatically replays a mutation', async () => {
    const request = vi.fn<typeof fetch>(async () => new Response('[]', { status: 200 }));
    const api = new AieApi('https://example.com', 'old', request);
    api.beforeRequest = vi.fn(async () => 'current');
    api.recoverUnauthorized = vi.fn(async () => 'refreshed');
    request.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await api.json(api.projects.apiProjectsGetRaw({}));
    expect(request).toHaveBeenCalledTimes(2);
    expect(new Headers(request.mock.calls[1][1]?.headers).get('Authorization')).toBe('Bearer refreshed');
    request.mockClear();
    request.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await expect(api.empty(api.queue.stopScanRaw({ scanResultId: 'id' }))).rejects.toMatchObject({
      code: 'AIE_LOGIN_REQUIRED',
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(api.recoverUnauthorized).toHaveBeenCalledTimes(2);
  });
  it('checks the current context before sending any request', async () => {
    const request = vi.fn(async () => new Response('{}'));
    const api = new AieApi('https://example.com', 'old', request);
    api.beforeRequest = async () => {
      throw new AieError('AIE_CONTEXT_CHANGED', 'Session changed.');
    };
    await expect(api.empty(api.queue.stopScanRaw({ scanResultId: 'id' }))).rejects.toMatchObject({
      code: 'AIE_CONTEXT_CHANGED',
    });
    expect(request).not.toHaveBeenCalled();
  });
  it('reports an unknown mutation outcome when a successful HTTP response loses its body', async () => {
    const request = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new DOMException('private message', 'AbortError'));
            },
          }),
        ),
    );
    const api = new AieApi('https://example.com', 'token', request);
    await expect(
      api.json(api.groups.apiConfigsPmGroupsPostRaw({ pMGroupUpsertModel: { name: 'fixture', rules: [] } })),
    ).rejects.toMatchObject({ code: 'AIE_CANCELLED', details: { effects: 'unknown', retryable: false } });
    expect(request).toHaveBeenCalledOnce();
  });
  it('accepts the real AIE scalar text/plain version response', async () => {
    const api = new AieApi(
      'https://example.com',
      'token',
      async () => new Response('6.3.0', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }),
    );
    expect(await api.json(api.version.apiVersionsPackageCurrentGetRaw())).toBe('6.3.0');
  });
  it('uses the generated endpoint and bearer header with ordinary TLS and no redirects', async () => {
    const request = vi.fn(
      async () => new Response(JSON.stringify('6.4.0'), { headers: { 'Content-Type': 'application/json' } }),
    );
    const api = new AieApi('https://example.com', 'synthetic-token', request);
    expect(await api.json(api.version.apiVersionsPackageCurrentGetRaw())).toBe('6.4.0');
    expect(request).toHaveBeenCalledWith(
      'https://example.com/api/versions/package/current',
      expect.objectContaining({ redirect: 'error', headers: { Authorization: 'Bearer synthetic-token' } }),
    );
  });
  it('separates license failures from permissions without returning raw server messages', async () => {
    const api = new AieApi(
      'https://example.com',
      'token',
      async () =>
        new Response(JSON.stringify({ errorCode: 'LicenseExpired', details: 'password=secret' }), { status: 403 }),
    );
    await expect(api.json(api.projects.apiProjectsGetRaw({}))).rejects.toMatchObject({ code: 'AIE_LICENSE_ERROR' });
  });
  it('does not replay a mutating request after a lost response', async () => {
    const request = vi.fn(async () => {
      throw new TypeError('lost token=secret');
    });
    const api = new AieApi('https://example.com', 'token', request);
    await expect(api.empty(api.queue.stopScanRaw({ scanResultId: 'id' }))).rejects.toMatchObject({
      code: 'AIE_NETWORK_ERROR',
      details: expect.objectContaining({ effects: 'unknown', retryable: false }),
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('limits actual streamed JSON bytes even without Content-Length', async () => {
    await expect(boundedBody(new Response('123456'), 5)).rejects.toMatchObject({ code: 'AIE_UPSTREAM_LIMIT' });
  });
  it('classifies corporate CA trust failures as TLS errors', async () => {
    const request = vi.fn(async () => {
      throw new TypeError('fetch failed', { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } });
    });
    const api = new AieApi('https://example.com', 'token', request);
    await expect(api.json(api.version.apiVersionsPackageCurrentGetRaw())).rejects.toMatchObject({
      code: 'AIE_TLS_ERROR',
    });
  });
});
