import { AieError } from './errors.js';

export function supportedVersion(value: unknown): string {
  if (typeof value !== 'string')
    throw new AieError('AIE_VERSION_UNKNOWN', 'AIE did not return a recognizable version.');
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[.\-+][A-Za-z0-9.\-+]+)?$/.exec(value.trim());
  if (!match) throw new AieError('AIE_VERSION_UNKNOWN', 'AIE did not return a recognizable version.');
  if (Number(match[1]) !== 6 || ![3, 4].includes(Number(match[2]))) {
    throw new AieError('AIE_VERSION_UNSUPPORTED', 'This POC supports only AIE 6.3.x and 6.4.x.', {
      next_action: 'Select an AIE 6.3.x or 6.4.x server. The existing shared session has been preserved.',
    });
  }
  return value.trim();
}
