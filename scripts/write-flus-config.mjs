import fs from 'node:fs';

const host = process.env.PTAI_FLUS_HOST;
const token = process.env.PTAI_FLUS_TOKEN;
const release = process.env.PTAI_RELEASE_BUILD === 'true';
if (release && (!host || !token))
  throw new Error('Release artifact requires PTAI_FLUS_HOST and PTAI_FLUS_TOKEN from the BE4P release configuration.');
if (host && new URL(host).protocol !== 'https:') throw new Error('FLUS host must use HTTPS.');
const config =
  host && token
    ? {
        enabled: true,
        host,
        instanceAccessToken: token,
        environment: process.env.PTAI_FLUS_ENVIRONMENT === 'test' ? 'test' : 'production',
      }
    : { enabled: false };
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/telemetry-config.json', JSON.stringify(config));
console.log(`FLUS artifact configuration: ${config.enabled ? 'enabled' : 'local build without release sender'}`);
