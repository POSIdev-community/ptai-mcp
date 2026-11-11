import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check using npm run audit:runtime after npm run build.');
const bundled = JSON.parse(fs.readFileSync('dist/bundled-dependencies.json', 'utf8'));
const bundledNames = new Set(bundled.map((item) => item.name));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const command = spawnSync(process.execPath, [npmCli, 'audit', '--json', '--registry=https://registry.npmjs.org'], {
  encoding: 'utf8',
  timeout: 90000,
  maxBuffer: 8 * 1024 * 1024,
});
if (command.error) throw command.error;
const report = JSON.parse(command.stdout);
if (
  report.error ||
  !report.vulnerabilities ||
  Array.isArray(report.vulnerabilities) ||
  command.signal ||
  ![0, 1].includes(command.status) ||
  (command.status === 1 && Object.keys(report.vulnerabilities).length === 0)
)
  throw new Error('npm audit failed to return a complete vulnerability report.');
const findings = Object.entries(report.vulnerabilities);
const runtime = findings.filter(([name, finding]) => {
  if (!Array.isArray(finding.nodes)) throw new Error(`Missing audit dependency paths for ${name}`);
  return (
    bundledNames.has(name) ||
    finding.nodes.some((node) => {
      if (!lock.packages[node]) throw new Error(`Unknown audit dependency path: ${node}`);
      return !lock.packages[node].dev;
    })
  );
});
console.log(
  JSON.stringify({
    runtime_vulnerabilities: runtime.length,
    audited_bundled_components: bundled.length,
    other_development_vulnerabilities: findings.length - runtime.length,
  }),
);
if (runtime.length) {
  for (const [name, finding] of runtime) console.error(`${finding.severity}: ${name}`);
  process.exitCode = 1;
}
