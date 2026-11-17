import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AieApi } from '../../../src/aie/api/client.js';
import { LoginAttempt } from '../../../src/aie/auth/login-attempt.js';
import { Sessions } from '../../../src/aie/auth/session.js';
import { SessionCodec } from '../../../src/aie/auth/session-codec.js';
import { withSessionLock } from '../../../src/aie/auth/session-lock.js';
import { SessionStorage } from '../../../src/aie/auth/session-storage.js';
import { ToolError } from '../../../src/shared/errors.js';

const attempts: LoginAttempt[] = [];
const sessions: Sessions[] = [];
const temporary: string[] = [];
afterEach(async () => {
  attempts.splice(0).forEach((attempt) => attempt.close());
  sessions.splice(0).forEach((session) => session.close());
  await Promise.all(temporary.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function attempt(complete: (code: string, signal: AbortSignal) => Promise<void>) {
  const open = vi.fn(async (_url: string) => false);
  const login = new LoginAttempt('https://example.com', complete, open);
  attempts.push(login);
  const view = await login.start();
  const auth = new URL(view.login_url);
  expect(auth.searchParams.get('scope')).toBe('Plugin');
  expect(auth.searchParams.get('type')).toBe('visualstudio');
  expect(new URL(auth.searchParams.get('callbackUrl')!).hostname).toBe('127.0.0.1');
  const state = auth.searchParams.get('state')!;
  const callback = (code: string) =>
    auth.searchParams.get('callbackUrl')!.replace('{code}', encodeURIComponent(code)).replace('{state}', state);
  const origin = new URL(view.manual_url).origin;
  const submit = (code: string, customOrigin = origin) =>
    fetch(view.manual_url.replace(/manual$/, 'submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: customOrigin, 'X-PTAI-Login': state },
      body: JSON.stringify({ code }),
    });
  return { login, view, callback, submit, open };
}

describe('loopback sign-in gate', () => {
  it.each([
    ['ru-RU, en;q=0.9', 'ru', 'Код авторизации'],
    ['ru;q=0.5, en-US;q=0.9', 'en', 'Authorization code'],
    ['de-DE, ru;q=0.8', 'ru', 'Код авторизации'],
    ['RU-ru', 'ru', 'Код авторизации'],
    ['de-DE', 'en', 'Authorization code'],
    ['', 'en', 'Authorization code'],
    ['*', 'en', 'Authorization code'],
    ['ru;q=0', 'en', 'Authorization code'],
    ['ru;q=invalid', 'en', 'Authorization code'],
    ['ru;q=2', 'en', 'Authorization code'],
    ['ru;q=0.5, de;q=invalid, en;q=1', 'en', 'Authorization code'],
  ])('localizes both pages for Accept-Language %s', async (language, expected, label) => {
    const { view, submit } = await attempt(async () => undefined);
    const headers = { 'Accept-Language': language };
    const manual = await (await fetch(view.manual_url, { headers })).text();
    expect(manual).toContain('<html lang="' + expected + '">');
    expect(manual).toContain(label);
    expect(manual).toContain(
      expected === 'ru' ? 'data-exchanging="Проверка кода…"' : 'data-exchanging="Checking the code…"',
    );
    expect(manual).toContain(expected === 'ru' ? 'Сервер: https://example.com' : 'Server: https://example.com');
    expect(manual).not.toContain('{{');
    await submit('test-code');
    const success = await (await fetch(view.manual_url.replace(/manual$/, 'success'), { headers })).text();
    expect(success).toContain('<html lang="' + expected + '">');
    expect(success).toContain(
      expected === 'ru' ? 'Теперь можно вернуться к вашему агенту.' : 'You can now return to your agent.',
    );
    expect(success).not.toContain('{{');
    if (expected === 'en') {
      expect(manual + success).not.toMatch(/[А-Яа-яЁё]/);
    }
  });
  it('completes manual sign-in when the browser callback never arrives', async () => {
    const complete = vi.fn(async () => undefined);
    const { login, view, submit, open } = await attempt(complete);
    expect(view.browser_opened).toBe(false);
    expect(view.next_action).toContain('login_url');
    expect(view.next_action).toContain('manual_url');
    expect(view.next_action).toContain('Visual Studio');
    expect(view.next_action).toContain('Check aie_get_context');
    expect(login.view().state).toBe('waiting');
    expect(complete).not.toHaveBeenCalled();
    const page = await fetch(view.manual_url, { headers: { 'Accept-Language': 'ru-RU' } });
    expect(await page.text()).toContain('Не вставляйте код в чат агента');
    await submit('synthetic-fallback-code');
    expect(login.view().state).toBe('connected');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(login.view())).not.toContain('synthetic-fallback-code');
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('serves external login assets under a restrictive CSP and rejects arbitrary asset paths', async () => {
    const { view } = await attempt(async () => undefined);
    const page = await fetch(view.manual_url, { headers: { 'Accept-Language': 'ru-RU' } });
    const policy = page.headers.get('content-security-policy')!;
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("style-src 'self'");
    expect(policy).not.toContain('unsafe-inline');
    const body = await page.text();
    expect(body).toContain('src="./manual.js"');
    expect(body).toContain('href="./login.css"');
    for (const script of body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
      expect(script[1].trim()).toBe('');
    }
    for (const [name, type] of [
      ['manual.js', 'text/javascript'],
      ['login.css', 'text/css'],
    ]) {
      const asset = await fetch(view.manual_url.replace(/manual$/, name));
      expect(asset.status).toBe(200);
      expect(asset.headers.get('content-type')).toContain(type);
      expect(asset.headers.get('cache-control')).toBe('no-store');
      expect(await asset.text()).not.toContain(new URL(view.login_url).searchParams.get('state'));
    }
    expect((await fetch(view.manual_url.replace(/manual$/, 'session-storage.ts'))).status).toBe(404);
  });
  it('opens a code-free local confirmation page after a successful browser callback', async () => {
    const { view, callback, open } = await attempt(async () => undefined);
    const successUrl = view.manual_url.replace(/manual$/, 'success');
    expect((await fetch(successUrl)).status).toBe(409);
    const response = await fetch(callback('sensitive-code'), { headers: { Origin: 'https://example.com' } });
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2));
    expect(open).toHaveBeenLastCalledWith(successUrl);
    expect(successUrl).not.toContain('sensitive-code');
    const page = await fetch(successUrl, { headers: { 'Accept-Language': 'ru-RU' } });
    expect(page.status).toBe(200);
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
    const body = await page.text();
    expect(body).toContain('Успешный вход');
    expect(body).toContain('вернуться к вашему агенту');
    expect(body).toContain('<svg');
    expect(body).not.toContain('sensitive-code');
    await fetch(callback('late-code'));
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('exchanges simultaneous browser/manual copies once and never echoes a code', async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((done) => {
      resolve = done;
    });
    const complete = vi.fn(async () => gate);
    const { login, view, callback, submit } = await attempt(complete);
    const browser = fetch(callback('sensitive-code'));
    const manual = submit('sensitive-code');
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    resolve();
    expect(await (await browser).text()).not.toContain('sensitive-code');
    expect(await (await manual).text()).not.toContain('sensitive-code');
    expect(login.view().state).toBe('connected');
    expect(view.browser_opened).toBe(false);
    await fetch(callback('late-code'));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(login.view())).not.toContain('sensitive-code');
  });
  it('rejects callback state and cross-origin manual submission', async () => {
    const complete = vi.fn(async () => undefined);
    const { callback, submit } = await attempt(complete);
    expect((await fetch(callback('code').replace(/state=[^&]+/, 'state=bad'))).status).toBe(403);
    expect((await submit('code', 'https://attacker.example')).status).toBe(403);
    expect(complete).not.toHaveBeenCalled();
  });
  it('provides a no-store manual page and explicit upstream CORS', async () => {
    const { view, callback, submit, open } = await attempt(async () => undefined);
    const page = await fetch(view.manual_url, { headers: { 'Accept-Language': 'ru-RU' } });
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    const body = await page.text();
    expect(body).toContain('Успешный вход');
    expect(body).toContain('введите его здесь');
    const font = await fetch(view.manual_url.replace(/manual$/, 'TT-Positive-Regular.woff2'));
    expect(font.status).toBe(200);
    expect(font.headers.get('content-type')).toBe('font/woff2');
    expect((await font.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    const preflight = await fetch(callback('code'), { method: 'OPTIONS', headers: { Origin: 'https://example.com' } });
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://example.com');
    await submit('code');
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('cancels a pending exchange and rejects its late callback', async () => {
    let signal!: AbortSignal;
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    const complete = vi.fn(async (_code: string, current: AbortSignal) => {
      signal = current;
      await pending;
    });
    const { login, callback } = await attempt(complete);
    const response = fetch(callback('code'));
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(login.cancel().state).toBe('cancelled');
    expect(signal.aborted).toBe(true);
    resolve();
    await response;
    await fetch(callback('another'));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(login.view().state).toBe('cancelled');
  });
  it('processes one alternate code after a confirmed invalid first code', async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<void>((_resolve, fail) => {
      reject = fail;
    });
    const complete = vi.fn(async (code: string) => {
      if (code === 'first') {
        await pending;
      }
    });
    const { login, callback, submit } = await attempt(complete);
    const first = fetch(callback('first'));
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    const alternate = submit('second');
    await new Promise((resolve) => setTimeout(resolve, 20));
    reject(new ToolError('AIE_VALIDATION_ERROR', 'Invalid code.', { effects: 'not_applied' }));
    await first;
    await alternate;
    await vi.waitFor(() => expect(login.view().state).toBe('connected'));
    expect(complete).toHaveBeenCalledTimes(2);
  });
  it('does not replay an unknown exchange outcome', async () => {
    const complete = vi.fn(async () => {
      throw new ToolError('AIE_NETWORK_ERROR', 'Lost response.', { effects: 'unknown' });
    });
    const { login, callback, submit } = await attempt(complete);
    await fetch(callback('first'));
    await submit('second');
    expect(login.view().state).toBe('failed');
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

async function fixture(version = '6.3.0') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-auth-'));
  temporary.push(root);
  const store = new SessionStorage(path.join(root, 'shared_variables'), new SessionCodec('test.user', 'TEST-MACHINE'));
  let currentVersion = version;
  let exchange: ((code: string, signal: AbortSignal) => Promise<void>) | undefined;
  const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const pathname = new URL(String(url)).pathname;
    if (pathname === '/api/versions/package/current') {
      return new Response(JSON.stringify(currentVersion));
    }
    if (pathname === '/api/auth/users/current') {
      return new Response(JSON.stringify({ id: 'user-id', name: 'Synthetic user', login: 'test' }));
    }
    if (pathname.endsWith('/permissions')) {
      return new Response('[]');
    }
    if (pathname === '/api/auth/external/signin/complete') {
      return new Response(JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' }));
    }
    if (pathname === '/api/auth/refreshToken') {
      return new Response(JSON.stringify({ accessToken: 'refreshed-access' }));
    }
    if (pathname === '/api/auth/signout') {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${pathname} ${init?.method}`);
  });
  const service = new Sessions(
    store,
    (origin, token) => new AieApi(origin, token, request),
    undefined,
    (origin, complete) => {
      exchange = complete;
      const value = new LoginAttempt(origin, complete, async () => false);
      attempts.push(value);
      return value;
    },
  );
  sessions.push(service);
  return {
    store,
    service,
    request,
    setVersion: (value: string) => {
      currentVersion = value;
    },
    exchange: (code = 'synthetic-code', signal = new AbortController().signal) => exchange!(code, signal),
  };
}

describe('shared AIE session lifecycle', () => {
  it('keeps readiness available when the shared directory watcher cannot be initialized', async () => {
    const { service } = await fixture();
    const mkdir = vi
      .spyOn(fs, 'mkdir')
      .mockRejectedValueOnce(Object.assign(new Error('inaccessible'), { code: 'EACCES' }));
    await expect(service.initialize()).resolves.toBeUndefined();
    mkdir.mockRestore();
    expect(await service.context()).toMatchObject({
      connected: false,
      storage_warning: expect.any(String),
      error: { code: 'AIE_LOGIN_REQUIRED' },
    });
  });
  it('does not publish a cancelled login after waiting for another process to release the session lock', async () => {
    const { service, store, exchange } = await fixture();
    const original = { AccessToken: 'old', RefreshToken: 'old-refresh', EnterpriseApiUri: 'https://old.example' };
    await store.write(original);
    const started = await service.auth({ action: 'login', server_url: 'https://example.com', force_login: true });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const locked = withSessionLock(store.file, async () => gate);
    await vi.waitFor(async () => expect(await fs.stat(`${store.file}.session-lock`)).toBeDefined());
    const write = vi.spyOn(store, 'write');
    const rejected = expect(exchange()).rejects.toMatchObject({ code: 'AIE_CANCELLED' });
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    await service.auth({ action: 'cancel_login', login_id: (started.login as { login_id: string }).login_id });
    release();
    await locked;
    await rejected;
    write.mockRestore();
    expect(await store.read()).toEqual(original);
  });
  it('distinguishes absent server and absent authentication', async () => {
    const { service } = await fixture();
    await expect(service.require()).rejects.toMatchObject({ code: 'AIE_LOGIN_REQUIRED' });
    await expect(service.auth({ action: 'login' })).rejects.toMatchObject({ code: 'AIE_SERVER_REQUIRED' });
  });
  it('validates 6.4 with the 6.3 API before publishing a new shared session', async () => {
    const { service, store, exchange } = await fixture('6.4.0');
    await service.auth({ action: 'login', server_url: 'https://example.com' });
    await exchange();
    expect(await store.read()).toMatchObject({ AccessToken: 'new-access', RefreshToken: 'new-refresh' });
    expect(await service.context()).toMatchObject({ connected: true, version: '6.4.0' });
    service.close();
    expect(await store.read()).not.toBeNull();
  });
  it('preserves the existing session after unsupported-version login and cancellation', async () => {
    const { service, store, exchange } = await fixture('6.5.0');
    const original = { AccessToken: 'old', RefreshToken: 'old-refresh', EnterpriseApiUri: 'https://old.example' };
    await store.write(original);
    const started = await service.auth({ action: 'login', server_url: 'https://example.com', force_login: true });
    await expect(exchange()).rejects.toMatchObject({ code: 'AIE_VERSION_UNSUPPORTED' });
    expect(await store.read()).toEqual(original);
    await service.auth({ action: 'cancel_login', login_id: (started.login as { login_id: string }).login_id });
    expect(await store.read()).toEqual(original);
  });
  it('reuses one pending attempt and explicitly clears shared storage on logout', async () => {
    const { service, store, exchange } = await fixture();
    const first = await service.auth({ action: 'login', server_url: 'https://example.com' });
    const second = await service.auth({ action: 'login', server_url: 'https://example.com' });
    expect(second.login).toEqual(first.login);
    expect(second.reused_attempt).toBe(true);
    await exchange();
    expect(await service.auth({ action: 'login', server_url: 'https://example.com' })).toMatchObject({
      reused_session: true,
    });
    expect(await service.auth({ action: 'logout' })).toMatchObject({ shared_session_cleared: true });
    expect(await store.read()).toBeNull();
  });
});
