import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import { renderLoginPage } from '../../../src/aie/auth/login-pages.js';

const script = fs.readFileSync(new URL('../../../assets/aie-login/manual.js', import.meta.url), 'utf8');

function browserPage(initialState = 'waiting') {
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
  const status = { textContent: '' };
  const heading = { textContent: 'Вход в AIE', dataset: { successLabel: 'Успешный вход' } };
  const manual = { hidden: false };
  const done = { hidden: true };
  const elements: Record<string, unknown> = {
    form,
    input,
    '#status': status,
    '#heading': heading,
    '#manual': manual,
    '#done': done,
  };
  const request = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === './submit') {
      state = 'connected';
    }
    return { json: async () => ({ state }) };
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
    request,
    clearInterval,
    submit: () => onSubmit({ preventDefault() {} }),
  };
}

it('keeps the manual code local and shows confirmation after a successful exchange', async () => {
  const page = browserPage();
  await vi.waitFor(() => expect(page.status.textContent).toBe('Ожидаем вход в браузере…'));
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

it.each(['cancelled', 'expired', 'failed'])('hides the form and stops polling after %s', async (state) => {
  const page = browserPage(state);
  await vi.waitFor(() => expect(page.form.hidden).toBe(true));
  expect(page.done.hidden).toBe(true);
  expect(page.clearInterval).toHaveBeenCalledWith(1);
});

it('escapes per-session values in the login template', () => {
  const html = renderLoginPage('manual', 'https://example.com/<script>', 'token" onfocus="injected');
  expect(html).not.toContain('https://example.com/<script>');
  expect(html).toContain('https://example.com/&lt;script&gt;');
  expect(html).toContain('data-login-token="token&quot; onfocus=&quot;injected"');
});
