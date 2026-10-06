import { afterEach, describe, expect, it, vi } from 'vitest';

const prompts = {
  confirm: vi.fn(),
  isCancel: vi.fn(),
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
};

vi.mock('@clack/prompts', () => prompts);

const { ALLOW_INSECURE_TLS_ENV, getDownloadSecurityOptions } = await import('../src/utils/downloadSecurity.js');

describe('download security prompts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(process.stdin, 'isTTY');
    Reflect.deleteProperty(process.stdout, 'isTTY');
    prompts.confirm.mockReset();
    prompts.isCancel.mockReset();
  });

  it('allows an explicit environment opt-in for non-interactive downloads', () => {
    vi.stubEnv(ALLOW_INSECURE_TLS_ENV, '1');

    expect(getDownloadSecurityOptions().allowInsecureTls).toBe(true);
  });

  it('explains how to opt in when a non-interactive process cannot prompt', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false });

    await expect(
      getDownloadSecurityOptions().confirmInsecureTls?.('https://flus-test.ptsecurity.ru/a.zip', new Error()),
    ).rejects.toThrow(ALLOW_INSECURE_TLS_ENV);
  });

  it('returns the interactive answer and handles cancellation', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    prompts.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    prompts.isCancel.mockReturnValueOnce(false).mockReturnValueOnce(true);

    const prompt = getDownloadSecurityOptions().confirmInsecureTls;

    await expect(prompt?.('https://flus-test.ptsecurity.ru/a.zip', new Error())).resolves.toBe(true);
    await expect(prompt?.('https://flus-test.ptsecurity.ru/a.zip', new Error())).resolves.toBe(false);
    expect(prompts.log.warn).toHaveBeenCalledTimes(2);
  });
});
