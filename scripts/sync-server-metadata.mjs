/* global process */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(root, 'package.json');
const serverPath = path.join(root, 'server.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const serverJson = JSON.parse(fs.readFileSync(serverPath, 'utf8'));

const mismatches = [];
if (serverJson.name !== packageJson.name) mismatches.push(`name (${serverJson.name} != ${packageJson.name})`);
if (serverJson.version !== packageJson.version)
  mismatches.push(`version (${serverJson.version} != ${packageJson.version})`);

if (process.argv.includes('--check')) {
  if (mismatches.length > 0) {
    throw new Error(`server.json is out of sync with package.json: ${mismatches.join(', ')}`);
  }
  process.stdout.write('server.json metadata is in sync.\n');
} else {
  serverJson.name = packageJson.name;
  serverJson.version = packageJson.version;
  fs.writeFileSync(serverPath, `${JSON.stringify(serverJson, null, 2)}\n`, 'utf8');
  process.stdout.write(`Synchronized server.json with package.json ${packageJson.version}.\n`);
}
