import { confirm, isCancel } from '@clack/prompts';
import { logger as log } from './logger.js';
import type { DownloadOptions } from './downloader.js';

export const ALLOW_INSECURE_TEST_TLS_ENV = 'PTAI_MCP_ALLOW_INSECURE_TEST_TLS';

export function getDownloadSecurityOptions(): Pick<DownloadOptions, 'allowInsecureTestTls' | 'confirmInsecureTestTls'> {
  return {
    allowInsecureTestTls: process.env[ALLOW_INSECURE_TEST_TLS_ENV] === '1',
    confirmInsecureTestTls: confirmInsecureTestTls,
  };
}

async function confirmInsecureTestTls(url: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `The test installer endpoint uses an untrusted TLS certificate and this process cannot prompt for confirmation. ` +
        `If you trust the endpoint, set ${ALLOW_INSECURE_TEST_TLS_ENV}=1 and retry.`,
    );
  }

  log.warn(`TLS certificate validation failed for ${new URL(url).hostname}.`);
  const answer = await confirm({
    message: 'Download from the PT test endpoint without verifying its TLS certificate?',
    initialValue: false,
  });
  return !isCancel(answer) && answer;
}
