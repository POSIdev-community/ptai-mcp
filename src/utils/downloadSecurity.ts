import { confirm, isCancel } from '@clack/prompts';
import { logger as log } from './logger.js';
import type { DownloadOptions } from './downloader.js';

export const ALLOW_INSECURE_TLS_ENV = 'PTAI_MCP_ALLOW_INSECURE_TLS';

export function getDownloadSecurityOptions(): Pick<DownloadOptions, 'allowInsecureTls' | 'confirmInsecureTls'> {
  return {
    allowInsecureTls: process.env[ALLOW_INSECURE_TLS_ENV] === '1',
    confirmInsecureTls: confirmInsecureTls,
  };
}

async function confirmInsecureTls(url: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `The installer endpoints use untrusted TLS certificates and this process cannot prompt for confirmation. ` +
        `If you trust the network, set ${ALLOW_INSECURE_TLS_ENV}=1 and retry.`,
    );
  }

  log.warn(`TLS certificate validation failed for ${new URL(url).hostname}.`);
  const answer = await confirm({
    message: 'Download without verifying TLS certificates? Continue only if you trust the network.',
    initialValue: false,
  });
  return !isCancel(answer) && answer;
}
