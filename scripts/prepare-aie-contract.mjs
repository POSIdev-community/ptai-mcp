import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const specification = process.argv[2];
if (!specification) {
  throw new Error('Usage: node scripts/prepare-aie-contract.mjs /path/to/AI.Api.Client/swagger/v6.3.0/swagger.yaml');
}
const source = fs.readFileSync(specification, 'utf8');
const document = YAML.parse(source);
const output = 'src/vendor/aie-v63';
const schemas = document.components.schemas;
const provenance = {
  api: '6.3.0',
  generator: 'typescript-fetch 7.0.0',
  swagger_sha256: crypto.createHash('sha256').update(source).digest('hex'),
};
fs.writeFileSync(
  path.join(output, 'contract.ts'),
  `// Generated from AI.Api.Client Swagger 6.3.0. Do not edit.\nexport const provenance = ${JSON.stringify(provenance)};\nexport const schemas: Record<string, Record<string, unknown>> = ${JSON.stringify(schemas)};\n`,
);

function patchImports(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      patchImports(file);
    } else if (entry.name.endsWith('.ts')) {
      // Generator 7's extensionless relative imports need ESM extensions under NodeNext.
      let text = fs.readFileSync(file, 'utf8');
      text = text.replace(
        /(from\s+['"])(\.[^'"]+)(['"])/g,
        (_match, a, module, b) => `${a}${module.endsWith('.js') ? module : `${module}.js`}${b}`,
      );
      text = text.replace(/[ \t]+(?=\r?$)/gm, '');
      fs.writeFileSync(file, text);
    }
  }
}
patchImports(path.join(output, 'src'));
// Ship only the API groups used by this adapter. The upstream Semgrep API has a
// dangling DTO reference and is outside the POC; no local edits to its DTOs.
const apiGroups = new Set([
  'Auth',
  'ExternalAuth',
  'Initiator',
  'User',
  'Version',
  'Projects',
  'Branches',
  'Store',
  'Configs',
  'PMGroups',
  'PmRuleVulnTypes',
  'Agents',
  'ScanQueue',
  'ChangeHistory',
]);
const apiDir = path.join(output, 'src', 'apis');
for (const entry of fs.readdirSync(apiDir)) {
  if (entry.endsWith('Api.ts') && !apiGroups.has(entry.slice(0, -6))) {
    fs.unlinkSync(path.join(apiDir, entry));
  }
}
fs.writeFileSync(
  path.join(apiDir, 'index.ts'),
  [...apiGroups].map((name) => `export * from './${name}Api.js';`).join('\n') + '\n',
);
fs.writeFileSync(
  path.join(output, 'PROVENANCE.md'),
  `# AIE API client\n\nGenerated locally from AI.Api.Client Swagger v6.3.0, using its configured\nOpenAPI Generator 7.0.0 typescript-fetch and modelPropertyNaming=original.\n\nSwagger SHA-256: \`${provenance.swagger_sha256}\`.\n\nThe source specification calls this the private API. This client has not been\npushed or published. Confirm redistribution terms before any public release.\nRelative imports are postprocessed to add .js for NodeNext. Runtime checks are\ndisabled in the generated client; domain writes use the bundled Swagger schemas.\n`,
);
console.log(JSON.stringify(provenance));
