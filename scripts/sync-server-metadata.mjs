/* global process */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(root, 'package.json');
const serverPath = path.join(root, 'server.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const serverSource = fs.readFileSync(serverPath, 'utf8');
const serverJson = JSON.parse(serverSource);

const npmPackage = serverJson.packages?.find((entry) => entry.registryType === 'npm');
const mismatches = [];
if (!packageJson.mcpName) mismatches.push('package.json.mcpName is missing');
if (serverJson.name !== packageJson.mcpName) mismatches.push(`name (${serverJson.name} != ${packageJson.mcpName})`);
if (serverJson.version !== packageJson.version)
  mismatches.push(`version (${serverJson.version} != ${packageJson.version})`);
if (!npmPackage) mismatches.push('server.json npm package entry is missing');
if (npmPackage && npmPackage.identifier !== packageJson.name)
  mismatches.push(`npm identifier (${npmPackage.identifier} != ${packageJson.name})`);
if (npmPackage && npmPackage.version !== packageJson.version)
  mismatches.push(`npm package version (${npmPackage.version} != ${packageJson.version})`);

if (process.argv.includes('--check')) {
  if (mismatches.length > 0) {
    throw new Error(`server.json is out of sync with package.json: ${mismatches.join(', ')}`);
  }
  process.stdout.write('server.json metadata is in sync.\n');
} else {
  if (!packageJson.mcpName) throw new Error('package.json must define mcpName before synchronizing server.json');
  if (!npmPackage) throw new Error('server.json must define an npm package entry before synchronizing');

  serverJson.name = packageJson.mcpName;
  serverJson.version = packageJson.version;
  npmPackage.identifier = packageJson.name;
  npmPackage.version = packageJson.version;
  fs.writeFileSync(serverPath, `${JSON.stringify(serverJson, null, 2)}\n`, 'utf8');
  process.stdout.write(`Synchronized server.json with package.json ${packageJson.version}.\n`);
}
