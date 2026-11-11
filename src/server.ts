import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { aieCatalog } from './aie/catalog.js';
import { AieDispatcher } from './aie/dispatcher.js';
import { localCatalog } from './local/catalog.js';
import { LocalRuntime } from './local/runtime.js';
import { result } from './aie/result.js';
import { safeError } from './aie/errors.js';
import { getPackageVersion } from './utils/packageMetadata.js';

export function createMcpServer(aie = new AieDispatcher(), local = new LocalRuntime()) {
  const server = new Server(
    { name: 'ptai_analyzer', version: getPackageVersion() },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...localCatalog.tools, ...aieCatalog] }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    if (params.name.startsWith('aie_')) return aie.call(params.name, params.arguments);
    try {
      return await local.call(params);
    } catch (error) {
      return result({ error: safeError(error, params.name) }, true);
    }
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [...localCatalog.resources] }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [...localCatalog.resourceTemplates],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => local.readResource(params.uri));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [...localCatalog.prompts] }));
  server.setRequestHandler(GetPromptRequestSchema, async ({ params }) =>
    local.getPrompt(params.name, params.arguments),
  );
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      try {
        await Promise.all([aie.close(), local.close()]);
      } finally {
        await server.close();
      }
    })());
  server.onclose = () => {
    void close().catch(() => undefined);
  };
  return { server, close, aie, local };
}

export async function startMcpServer(args: string[] = []) {
  const runtime = createMcpServer(undefined, new LocalRuntime(args));
  await runtime.aie.sessions.initialize();
  await runtime.server.connect(new StdioServerTransport());
  const shutdown = () => {
    void runtime.close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return runtime;
}
