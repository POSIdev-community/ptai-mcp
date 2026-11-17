import { afterEach, describe, expect, it, vi } from 'vitest';
import { networkError } from '../../../src/aie/api/http-errors.js';
import { LoginAttempt } from '../../../src/aie/auth/login-attempt.js';

const attempts: LoginAttempt[] = [];

afterEach(() => attempts.splice(0).forEach((attempt) => attempt.close()));

async function fixture() {
  const complete = vi.fn(async () => {
    throw networkError(
      new TypeError('fetch failed', { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } }),
      true,
      'https://aie.example',
    );
  });
  const open = vi.fn(async (_url: string) => false);
  const attempt = new LoginAttempt('https://aie.example', complete, open);
  attempts.push(attempt);
  const view = await attempt.start();
  const loginUrl = new URL(view.login_url);
  const callback = loginUrl.searchParams
    .get('callbackUrl')!
    .replace('{code}', 'private-test-code')
    .replace('{state}', loginUrl.searchParams.get('state')!);
  return { attempt, view, callback, complete, open };
}

describe('visible callback failure', () => {
  it('opens one local failure page after a browser callback and never opens a success page', async () => {
    const f = await fixture();
    const response = await fetch(f.callback, { headers: { Origin: 'https://aie.example' } });
    expect(await response.json()).toEqual({ state: 'failed' });
    await vi.waitFor(() => expect(f.open).toHaveBeenCalledTimes(2));
    expect(f.open).toHaveBeenLastCalledWith(f.view.manual_url);
    expect(f.view.manual_url).not.toContain('private-test-code');
    const page = await fetch(f.view.manual_url);
    expect(page.status).toBe(200);
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
    const status = await (await fetch(f.view.manual_url.replace(/manual$/, 'status'))).json();
    expect(status).toEqual({
      state: 'failed',
      error: 'Node could not verify the server certificate chain.',
      certificate_error: true,
    });
    expect(JSON.stringify(status)).not.toContain('private-test-code');
    expect((await fetch(f.view.manual_url.replace(/manual$/, 'success'))).status).toBe(409);
    await fetch(f.callback);
    expect(f.open).toHaveBeenCalledTimes(2);
    expect(f.complete).toHaveBeenCalledTimes(1);
  });

  it('keeps an already opened manual page as the result view without creating a duplicate tab', async () => {
    const f = await fixture();
    await fetch(f.view.manual_url);
    await fetch(f.callback);
    expect(f.attempt.view().state).toBe('failed');
    expect(f.open).toHaveBeenCalledTimes(1);
  });
});
