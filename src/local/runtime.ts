import fs from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { type CallToolRequest, type CallToolResult, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpMethod } from '../mcp/constants.js';
import { INSTALLER_PRODUCT_ID } from '../services/bundle-constants.js';
import { Effects } from '../shared/effects.js';
import { ErrorCode } from '../shared/error-codes.js';
import { ToolError } from '../shared/errors.js';
import { ProcessStdio } from '../shared/io-constants.js';
import { getProxyPath, readVersionsJson } from '../utils/paths.js';
import { localCatalog } from './catalog.js';
import { assertCompatibleCatalog } from './catalog-compatibility.js';

/** The catalog is static; only a local operation is allowed to start McpProxy. */
export class LocalRuntime {

  private client?: Client;
  private connecting?: Promise<Client>;
  private closing = false;

  public constructor(private readonly args: string[] = []) {}

  public async call(params: CallToolRequest['params']): Promise<CallToolResult> {
    if (!localCatalog.tools.some((tool) => tool.name === params.name)) {
      throw new ToolError(ErrorCode.LocalToolUnknown, 'Unknown local tool.');
    }

    const client = await this.connect();

    try {
      return await client.request({ method: McpMethod.CallTool, params }, CallToolResultSchema, {
        timeout: 30 * 60_000,
      });
    } catch {
      throw new ToolError(
        ErrorCode.LocalProxyDisconnected,
        'Local proxy call failed. Inspect the local scan before retrying a modifying operation.',
        { effects: Effects.Unknown },
      );
    }
  }

  public async readResource(uri: string) {
    return (await this.connect()).readResource({ uri });
  }

  public async getPrompt(name: string, args?: Record<string, string>) {
    return (await this.connect()).getPrompt({ name, arguments: args });
  }

  public async close() {
    this.closing = true;
    await this.connecting?.catch(() => undefined);
    const client = this.client;
    this.client = undefined;
    await client?.close();
  }

  private async connect(): Promise<Client> {
    if (this.closing) {
      throw new ToolError(ErrorCode.LocalProxyDisconnected, 'The local runtime has shut down.');
    }

    if (this.client) {
      return this.client;
    }

    if (this.connecting) {
      return this.connecting;
    }

    const proxy = getProxyPath();
    const actual = readVersionsJson()?.[INSTALLER_PRODUCT_ID];

    if (!fs.existsSync(proxy) && actual) {
      throw new ToolError(
        ErrorCode.LocalBundleIncompatible,
        'The installed analyzer bundle has no compatible McpProxy.',
        {
          next_action: 'npx -y @posidev-community/ptai-mcp update, then restart the MCP server',
          effects: Effects.NotApplied,
        },
      );
    }

    if (!fs.existsSync(proxy)) {
      throw new ToolError(ErrorCode.LocalBundleRequired, 'The local analyzer bundle is required for this tool.', {
        next_action: 'npx -y @posidev-community/ptai-mcp install',
        effects: Effects.NotApplied,
      });
    }

    this.connecting = this.openConnection(proxy).finally(() => {
      this.connecting = undefined;
    });

    return this.connecting;
  }

  private async openConnection(proxy: string): Promise<Client> {
    const env = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    const transport = new StdioClientTransport({ command: proxy, args: this.args, stderr: ProcessStdio.Pipe, env });
    const client = new Client({ name: 'ptai-local-dispatcher', version: '1.0.0' });

    // A child failure invalidates this connection; it never terminates the Node server.
    client.onclose = () => {
      if (this.client === client) {
        this.client = undefined;
      }
    };

    try {
      await client.connect(transport);
      transport.stderr?.on('data', () => undefined);
      await assertCompatibleCatalog(client);
      this.client = client;

      return client;
    } catch (error) {
      await client.close().catch(() => undefined);

      if (error instanceof ToolError) {
        throw error;
      }

      throw new ToolError(ErrorCode.LocalProxyStartFailed, 'Could not start the local analyzer proxy.');
    }
  }
}
