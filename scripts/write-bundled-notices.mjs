import fs from 'node:fs';
import path from 'node:path';

const metafile = 'dist/metafile-esm.json';
const metadata = JSON.parse(fs.readFileSync(metafile, 'utf8'));
const roots = new Set();
for (const input of Object.keys(metadata.inputs)) {
  const parts = input.replaceAll('\\', '/').split('/');
  const index = parts.lastIndexOf('node_modules');
  if (index < 0) {
    continue;
  }
  const end = index + (parts[index + 1].startsWith('@') ? 3 : 2);
  roots.add(parts.slice(0, end).join('/'));
}

const dependencies = [];
const notices = ['Third-party components included in the compiled CLI.\n'];
for (const root of [...roots].sort()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const license = fs.readdirSync(root).find((name) => /^licen[cs]e(?:\.(?:md|txt))?$/i.test(name));
  if (!license || typeof pkg.name !== 'string' || typeof pkg.version !== 'string' || typeof pkg.license !== 'string') {
    throw new Error(`Missing package identity or license for bundled component: ${root}`);
  }
  dependencies.push({ name: pkg.name, version: pkg.version, license: pkg.license });
  notices.push(`${'='.repeat(72)}\n${pkg.name}@${pkg.version} (${pkg.license})\n\n`);
  notices.push(fs.readFileSync(path.join(root, license), 'utf8').trim() + '\n\n');
}
if (!dependencies.some((item) => item.name === '@modelcontextprotocol/sdk')) {
  throw new Error('The compiled CLI must include the stdio SDK.');
}
fs.writeFileSync('dist/THIRD_PARTY_NOTICES.txt', notices.join(''));
fs.writeFileSync('dist/bundled-dependencies.json', JSON.stringify(dependencies, null, 2));
fs.unlinkSync(metafile);
console.log(`Bundled component licenses: ${dependencies.length}`);
