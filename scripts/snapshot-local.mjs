import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const proxy = process.argv[2];
if (!proxy) throw new Error('Pass the installed McpProxy executable. Listing does not start an analyzer.');
const transport = new StdioClientTransport({
  command: proxy,
  args: [],
  stderr: 'pipe',
  env: { ...process.env, PTAI_DISABLE_TELEMETRY: 'true' },
});
const client = new Client({ name: 'ptai-catalog-snapshot', version: '1.0.0' });
try {
  await client.connect(transport);
  const tools = await client.listTools();
  const resources = await client.listResources();
  const templates = await client.listResourceTemplates();
  const prompts = await client.listPrompts();
  const versions = JSON.parse(fs.readFileSync(path.join(path.dirname(proxy), 'versions.json'), 'utf8'));
  const snapshot = {
    bundle_version: versions['AI.INFRASTRUCTURE.INSTALLATOR'],
    server: client.getServerVersion(),
    tools: tools.tools,
    resources: resources.resources,
    resourceTemplates: templates.resourceTemplates,
    prompts: prompts.prompts,
  };
  fs.mkdirSync('src/local', { recursive: true });
  fs.writeFileSync(
    'src/local/catalog.ts',
    `// Captured from installed McpProxy, bundle ${snapshot.bundle_version}.\nexport const localCatalog = ${JSON.stringify(snapshot, null, 2)} as const;\n`,
  );
  console.log(
    JSON.stringify({
      tools: snapshot.tools.length,
      resources: snapshot.resources.length,
      templates: snapshot.resourceTemplates.length,
      prompts: snapshot.prompts.length,
      server: snapshot.server,
    }),
  );
} finally {
  await client.close();
}
