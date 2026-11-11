import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FlusConfig } from './types.js';

export function readFlusConfig(): FlusConfig {
  const current = path.dirname(fileURLToPath(import.meta.url));

  for (const file of [
    path.join(current, 'telemetry-config.json'),
    path.join(current, '../../dist/telemetry-config.json'),
  ]) {
    try {
      const config = JSON.parse(fs.readFileSync(file, 'utf8')) as FlusConfig;

      if (config.enabled && config.host && config.instanceAccessToken && new URL(config.host).protocol === 'https:') {
        return config;
      }
    } catch {
      /* A local build without release credentials has no sender. */
    }
  }

  return { enabled: false };
}
