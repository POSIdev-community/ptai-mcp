import fs from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, type CallToolResult, type CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { getProxyPath, readVersionsJson } from '../utils/paths.js';
import { localCatalog } from './catalog.js';
import { AieError } from '../aie/errors.js';
import { revision } from '../aie/schema.js';

/** The catalog is static; only a local operation is allowed to start McpProxy. */
export class LocalRuntime {
  private client?: Client;
  private connecting?: Promise<Client>;
  private closing = false;

  constructor(private readonly args: string[] = []) {}

  async call(params: CallToolRequest['params']): Promise<CallToolResult> {
    if (!localCatalog.tools.some((tool) => tool.name === params.name))
      throw new AieError('LOCAL_TOOL_UNKNOWN', 'Unknown local tool.');
    const client = await this.connect();
    try {
      return await client.request({ method: 'tools/call', params }, CallToolResultSchema, { timeout: 30 * 60_000 });
    } catch {
      throw new AieError(
        'LOCAL_PROXY_DISCONNECTED',
        'Local proxy call failed. Inspect the local scan before retrying a modifying operation.',
        { effects: 'unknown' },
      );
    }
  }

  async readResource(uri: string) {
    return (await this.connect()).readResource({ uri });
  }
  async getPrompt(name: string, args?: Record<string, string>) {
    return (await this.connect()).getPrompt({ name, arguments: args });
  }
  async close() {
    this.closing = true;
    await this.connecting?.catch(() => undefined);
    const client = this.client;
    this.client = undefined;
    await client?.close();
  }

  private async connect(): Promise<Client> {
    if (this.closing) throw new AieError('LOCAL_PROXY_DISCONNECTED', 'The local runtime has shut down.');
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    const proxy = getProxyPath();
    const actual = readVersionsJson()?.['AI.INFRASTRUCTURE.INSTALLATOR'];
    if (!fs.existsSync(proxy) && actual)
      throw new AieError('LOCAL_BUNDLE_INCOMPATIBLE', 'The installed analyzer bundle has no compatible McpProxy.', {
        next_action: 'npx -y @posidev-community/ptai-mcp update, then restart the MCP server',
        effects: 'not_applied',
      });
    if (!fs.existsSync(proxy))
      throw new AieError('LOCAL_BUNDLE_REQUIRED', 'The local analyzer bundle is required for this tool.', {
        next_action: 'npx -y @posidev-community/ptai-mcp install',
        effects: 'not_applied',
      });
    this.connecting = (async () => {
      const env = Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );
      const transport = new StdioClientTransport({ command: proxy, args: this.args, stderr: 'pipe', env });
      const client = new Client({ name: 'ptai-local-dispatcher', version: '1.0.0' });
      // A child failure invalidates this connection; it never terminates the Node server.
      client.onclose = () => {
        if (this.client === client) this.client = undefined;
      };
      try {
        await client.connect(transport);
        transport.stderr?.on('data', () => undefined);
        const actualTools = (await client.listTools()).tools;
        const shape = (tools: ReadonlyArray<{ name: string; inputSchema: unknown }>) =>
          tools
            .map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema }))
            .sort((a, b) => a.name.localeCompare(b.name));
        if (revision(shape(actualTools)) !== revision(shape(localCatalog.tools))) {
          throw new AieError(
            'LOCAL_BUNDLE_INCOMPATIBLE',
            'The installed proxy tool schemas do not match the bundled catalog.',
            {
              next_action: 'Use a verified npm/bundle pair or update the bundle, then restart MCP.',
              effects: 'not_applied',
            },
          );
        }
        const resources = (await client.listResources()).resources.map(({ name, uri, mimeType }) => ({
          name,
          uri,
          mimeType,
        }));
        const templates = (await client.listResourceTemplates()).resourceTemplates.map(
          ({ name, uriTemplate, mimeType }) => ({ name, uriTemplate, mimeType }),
        );
        const prompts = (await client.listPrompts()).prompts.map(({ name, arguments: args }) => ({
          name,
          arguments: args ?? [],
        }));
        const sorted = <T>(items: T[]) => items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        if (
          revision(sorted(resources)) !==
            revision(sorted(localCatalog.resources.map(({ name, uri, mimeType }) => ({ name, uri, mimeType })))) ||
          revision(sorted(templates)) !== revision(sorted([...localCatalog.resourceTemplates])) ||
          revision(sorted(prompts)) !==
            revision(sorted(localCatalog.prompts.map(({ name, arguments: args }) => ({ name, arguments: args }))))
        ) {
          throw new AieError(
            'LOCAL_BUNDLE_INCOMPATIBLE',
            'The installed proxy resources or prompts do not match the bundled catalog.',
            { effects: 'not_applied' },
          );
        }
        this.client = client;
        return client;
      } catch (error) {
        await client.close().catch(() => undefined);
        if (error instanceof AieError) throw error;
        throw new AieError('LOCAL_PROXY_START_FAILED', 'Could not start the local analyzer proxy.');
      }
    })().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }
}
