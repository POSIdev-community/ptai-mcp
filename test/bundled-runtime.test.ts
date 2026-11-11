import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../scripts/audit-runtime.mjs', import.meta.url));
const temporary: string[] = [];
afterEach(async () => {
  for (const root of temporary.splice(0)) {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('ptai-bundled-audit-'))
      throw new Error('Unexpected audit fixture cleanup path');
    await fs.rm(root, { recursive: true, force: true });
  }
});

async function audit(report: unknown) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-bundled-audit-'));
  temporary.push(root);
  await fs.mkdir(path.join(root, 'dist'));
  await fs.writeFile(path.join(root, 'dist/bundled-dependencies.json'), JSON.stringify([{ name: 'sdk' }]));
  await fs.writeFile(
    path.join(root, 'package-lock.json'),
    JSON.stringify({
      packages: {
        'node_modules/sdk': { dev: true },
        'node_modules/development': { dev: true },
        'node_modules/production': {},
      },
    }),
  );
  await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report));
  const fakeNpm = path.join(root, 'npm.mjs');
  await fs.writeFile(
    fakeNpm,
    "import fs from 'node:fs';process.stdout.write(fs.readFileSync('report.json','utf8'));process.exitCode=1;",
  );
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'npm_execpath'));
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...env, npm_execpath: fakeNpm },
    encoding: 'utf8',
    timeout: 10000,
  });
}

const finding = (name: string) => ({ severity: 'high', nodes: [`node_modules/${name}`] });

describe('auditing the installed and compiled runtime', () => {
  it('separates unrelated development advisories from runtime', async () => {
    const result = await audit({ vulnerabilities: { development: finding('development') } });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      runtime_vulnerabilities: 0,
      other_development_vulnerabilities: 1,
    });
  });
  it('does not hide an affected bundled SDK behind its dev dependency flag', async () => {
    const result = await audit({ vulnerabilities: { sdk: finding('sdk') } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('high: sdk');
    expect(JSON.parse(result.stdout).runtime_vulnerabilities).toBe(1);
  });
  it('rejects an affected installed production dependency', async () => {
    const result = await audit({ vulnerabilities: { production: finding('production') } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('high: production');
  });
  it('fails closed when the report names an unknown dependency path', async () => {
    const result = await audit({ vulnerabilities: { unknown: finding('unknown') } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown audit dependency path');
    expect(result.stdout).not.toContain('runtime_vulnerabilities');
  });
  it('does not report zero after an audit transport failure', async () => {
    const result = await audit({ error: { code: 'ENETUNREACH' } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('complete vulnerability report');
    expect(result.stdout).not.toContain('runtime_vulnerabilities');
  });
});
