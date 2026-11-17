import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AieApi } from '../../../src/aie/api/client.js';
import { LoginAttempt } from '../../../src/aie/auth/login-attempt.js';
import { Sessions } from '../../../src/aie/auth/session.js';
import { SessionStorage } from '../../../src/aie/auth/session-storage.js';

const cleanups: Array<() => Promise<void>> = [];
const old = { EnterpriseApiUri: 'https://old.example', AccessToken: 'old-secret', RefreshToken: 'old-refresh' };

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
});

async function fixture(fail = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aie-login-context-'));
  const storage = new SessionStorage(path.join(root, 'shared_variables'));
  await storage.write(old);
  const request = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    if (url.origin === old.EnterpriseApiUri) {
      throw new Error('Old server is unreachable');
    }
    if (fail) {
      throw new TypeError('private-code', { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } });
    }
    if (url.pathname.endsWith('/signin/complete')) {
      return Response.json({ accessToken: 'new-secret', refreshToken: 'new-refresh' });
    }
    if (url.pathname.endsWith('/current') && url.pathname.includes('/versions/')) {
      return Response.json('6.4.0');
    }
    if (url.pathname.endsWith('/current')) {
      return Response.json({ id: 'user-id', login: 'test' });
    }
    return Response.json([]);
  });
  const service = new Sessions(
    storage,
    (origin, token) => new AieApi(origin, token, request),
    undefined,
    (origin, complete) => new LoginAttempt(origin, complete, async () => false),
  );
  cleanups.push(async () => {
    service.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const started = await service.auth({ action: 'login', server_url: 'https://new.example' });
  const login = started.login as { login_id: string; login_url: string };
  const url = new URL(login.login_url);
  const callback = url.searchParams
    .get('callbackUrl')!
    .replace('{code}', 'synthetic-code')
    .replace('{state}', url.searchParams.get('state')!);
  return { service, storage, request, loginId: login.login_id, complete: () => fetch(callback) };
}

describe('login attempt context', () => {
  it('polls the selected login locally without validating or refreshing an unrelated session', async () => {
    const f = await fixture();
    expect(await f.service.context(f.loginId)).toMatchObject({
      context_scope: 'login_attempt',
      connected: false,
      server_url: 'https://new.example',
      login: { state: 'waiting' },
      current_session: { server_url: old.EnterpriseApiUri, validation: 'not_checked' },
    });
    expect(f.request).not.toHaveBeenCalled();
    expect(await f.storage.read()).toEqual(old);
    expect(await f.service.context()).toMatchObject({
      context_scope: 'session',
      server_url: old.EnterpriseApiUri,
      error: { code: 'AIE_NETWORK_ERROR' },
    });
  });

  it('reports the target TLS failure without the previous server error or credentials', async () => {
    const f = await fixture(true);
    await f.complete();
    const context = await f.service.context(f.loginId);
    expect(context).toMatchObject({
      connected: false,
      server_url: 'https://new.example',
      login: { state: 'failed', error: { code: 'AIE_TLS_ERROR', tls: { server_url: 'https://new.example' } } },
    });
    expect(context.error).toBeUndefined();
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(await f.storage.read()).toEqual(old);
    expect(JSON.stringify(context)).not.toMatch(/old-secret|old-refresh|private-code|synthetic-code/);
  });

  it('confirms the new session and rejects a later switch to another server', async () => {
    const f = await fixture();
    await f.complete();
    expect(await f.service.context(f.loginId)).toMatchObject({
      context_scope: 'login_attempt',
      connected: true,
      server_url: 'https://new.example',
      user: { id: 'user-id' },
      login: { state: 'connected' },
    });
    await f.storage.write(old);
    await expect(f.service.context(f.loginId)).rejects.toMatchObject({ code: 'AIE_CONTEXT_CHANGED' });
  });

  it('keeps cancelled attempts scoped to their target and reports unknown IDs', async () => {
    const f = await fixture();
    await f.service.auth({ action: 'cancel_login', login_id: f.loginId });
    expect(await f.service.context(f.loginId)).toMatchObject({ connected: false, login: { state: 'cancelled' } });
    expect(f.request).not.toHaveBeenCalled();
    await expect(f.service.context('unknown')).rejects.toMatchObject({ code: 'AIE_LOGIN_NOT_FOUND' });
  });
});
