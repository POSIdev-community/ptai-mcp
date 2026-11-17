import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPackageVersion } from './packageMetadata.js';

export function buildIdentity() {
  const file = fileURLToPath(import.meta.url);
  const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);

  return { version: getPackageVersion(), sha256_prefix: hash };
}
