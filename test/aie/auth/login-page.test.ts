import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import { renderLoginPage } from '../../../src/aie/auth/login-pages.js';

const script = fs.readFileSync(new URL('../../../assets/aie-login/manual.js', import.meta.url), 'utf8');

function browserPage(initialState = 'waiting', language = 'ru', error = '', certificateError = false) {
  const html = renderLoginPage('manual', 'https://example.com', 'synthetic-csrf', language);
  const statusTag = html.match(/<p\s+id="status"[^>]*>/)![0];
  const dataset = Object.fromEntries(
    [...statusTag.matchAll(/data-([a-z]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
  let state = initialState;
  let onSubmit!: (event: { preventDefault(): void }) => Promise<void>;
  const form = {
    hidden: false,
    dataset: { loginToken: 'synthetic-csrf' },
    addEventListener: (_type: string, handler: typeof onSubmit) => {
      onSubmit = handler;
    },
  };
  const input = { value: '' };
  const status = { textContent: '', dataset };
  const heading = { textContent: '', dataset: { successLabel: html.match(/data-success-label="([^"]*)"/)![1] } };
  const manual = { hidden: false };
  const done = { hidden: true };
  const tlsHelp = { hidden: true };
  const elements: Record<string, unknown> = {
    form,
    input,
    '#status': status,
    '#heading': heading,
    '#manual': manual,
    '#done': done,
    '#tls-help': tlsHelp,
  };
  const request = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === './submit') {
      state = 'connected';
    }
    return { json: async () => ({ state, error, certificate_error: certificateError }) };
  });
  const clearInterval = vi.fn();
  vm.runInNewContext(script, {
    document: { querySelector: (selector: string) => elements[selector] },
    fetch: request,
    setInterval: () => 1,
    clearInterval,
  });
  return {
    form,
    input,
    status,
    heading,
    manual,
    done,
    tlsHelp,
    request,
    clearInterval,
    submit: () => onSubmit({ preventDefault() {} }),
  };
}

it('keeps the manual code local and shows confirmation after a successful exchange', async () => {
  const page = browserPage();
  await vi.waitFor(() => expect(page.status.textContent).toBe('Ожидание входа в браузере…'));
  page.input.value = 'synthetic-private-code';
  await page.submit();
  expect(page.request).toHaveBeenCalledWith('./submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-PTAI-Login': 'synthetic-csrf' },
    body: JSON.stringify({ code: 'synthetic-private-code' }),
  });
  expect(page.input.value).toBe('');
  expect(page.status.textContent).not.toContain('synthetic-private-code');
  expect(page.heading.textContent).toBe('Успешный вход');
  expect(page.manual.hidden).toBe(true);
  expect(page.done.hidden).toBe(false);
  expect(page.clearInterval).toHaveBeenCalledWith(1);
});

it.each(['ru-RU', 'en-US'])('shows certificate remedies with an origin-specific example: %s', async (language) => {
  const page = browserPage('failed', language, 'Certificate failure', true);
  await vi.waitFor(() => expect(page.tlsHelp.hidden).toBe(false));
  expect(page.done.hidden).toBe(true);
  expect(page.manual.hidden).toBe(true);
  const html = renderLoginPage('manual', 'https://example.com:8443', '', language);
  expect(html).toContain('NODE_EXTRA_CA_CERTS');
  expect(html).toContain('PTAI_MCP_AIE_INSECURE_TLS_ORIGINS');
  expect(html).toContain('https://example.com:8443');
  expect(html).toContain(language === 'ru-RU' ? 'Явно разрешите' : 'Explicitly authorize');
});

it('keeps certificate exceptions hidden for protocol errors and completed sign-in', async () => {
  const failed = browserPage('failed', 'en', 'TLS protocol failure');
  const connected = browserPage('connected', 'en', '', true);
  await vi.waitFor(() => expect(failed.form.hidden).toBe(true));
  expect(failed.tlsHelp.hidden).toBe(true);
  expect(connected.tlsHelp.hidden).toBe(true);
});

it.each(['cancelled', 'expired', 'failed'])('shows recovery instructions and stops polling after %s', async (state) => {
  const page = browserPage(state);
  await vi.waitFor(() => expect(page.form.hidden).toBe(true));
  expect(page.manual.hidden).toBe(true);
  expect(page.done.hidden).toBe(false);
  expect(page.done).toHaveProperty('textContent', expect.stringContaining('Вернитесь к агенту'));
  expect(page.clearInterval).toHaveBeenCalledWith(1);
});

it('escapes per-session values in the login template', () => {
  const html = renderLoginPage('manual', 'https://example.com/<script>', 'token" onfocus="injected');
  expect(html).not.toContain('https://example.com/<script>');
  expect(html).toContain('https://example.com/&lt;script&gt;');
  expect(html).toContain('data-login-token="token&quot; onfocus=&quot;injected"');
});

it('shows the failure cause with recovery instructions and consistent punctuation', async () => {
  const page = browserPage('failed', 'en', 'Node could not verify the server certificate chain.');
  await vi.waitFor(() =>
    expect(page.status.textContent).toBe(
      'Could not complete sign-in: Node could not verify the server certificate chain.',
    ),
  );
  expect(page.manual.hidden).toBe(true);
  expect(page.done).toHaveProperty('textContent', expect.stringContaining('Return to your agent'));
});

it.each([
  ['en-US', 'Waiting for sign-in in the browser…', 'Signed in', 'You can now return to your agent.'],
  ['ru-RU', 'Ожидание входа в браузере…', 'Успешный вход', 'Теперь можно вернуться к вашему агенту.'],
  ['', 'Waiting for sign-in in the browser…', 'Signed in', 'You can now return to your agent.'],
])('keeps dynamic status messages in the selected language: %s', async (language, waiting, heading, connected) => {
  const page = browserPage('waiting', language);
  await vi.waitFor(() => expect(page.status.textContent).toBe(waiting));
  page.input.value = 'synthetic-private-code';
  await page.submit();
  expect(page.heading.textContent).toBe(heading);
  expect(page.status.textContent).toBe(connected);
});
