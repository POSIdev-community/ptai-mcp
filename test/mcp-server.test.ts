import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, expect, it, vi } from 'vitest';
import { AieDispatcher } from '../src/aie/mcp/dispatcher.js';
import { localCatalog } from '../src/local/catalog.js';
import { LocalRuntime } from '../src/local/runtime.js';
import { createMcpServer } from '../src/mcp/server.js';
import { ToolError } from '../src/shared/errors.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((run) => run()));
  vi.restoreAllMocks();
});

it('serves the complete static MCP catalog without starting the local runtime or requiring login', async () => {
  const local = new LocalRuntime();
  const call = vi
    .spyOn(local, 'call')
    .mockRejectedValue(new ToolError('LOCAL_BUNDLE_REQUIRED', 'Install the local bundle.'));
  const resource = vi
    .spyOn(local, 'readResource')
    .mockResolvedValue({ contents: [{ uri: localCatalog.resources[0].uri, text: 'fixture' }] });
  const prompt = vi
    .spyOn(local, 'getPrompt')
    .mockResolvedValue({ messages: [{ role: 'user', content: { type: 'text', text: 'fixture' } }] });
  const localClose = vi.spyOn(local, 'close').mockResolvedValue();
  const aie = new AieDispatcher(undefined, { invocation: vi.fn(), action: vi.fn(), close: async () => undefined });
  vi.spyOn(aie.sessions, 'require').mockRejectedValue(new ToolError('AIE_LOGIN_REQUIRED', 'Sign in.'));
  const runtime = createMcpServer(aie, local);
  const client = new Client({ name: 'protocol-test', version: '1.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await runtime.server.connect(serverTransport);
  await client.connect(clientTransport);
  cleanup.push(async () => {
    await client.close();
    await runtime.close();
  });
  const tools = (await client.listTools()).tools;
  expect(tools).toHaveLength(32);
  expect(new Set(tools.map((tool) => tool.name)).size).toBe(32);
  expect(tools.filter((tool) => tool.name.startsWith('aie_'))).toHaveLength(21);
  expect((await client.listResources()).resources).toEqual(localCatalog.resources);
  expect((await client.listResourceTemplates()).resourceTemplates).toEqual([]);
  expect((await client.listPrompts()).prompts).toEqual(localCatalog.prompts);
  expect(call).not.toHaveBeenCalled();
  expect(resource).not.toHaveBeenCalled();
  expect(prompt).not.toHaveBeenCalled();
  expect(await client.callTool({ name: 'aie_list_projects' })).toMatchObject({
    isError: true,
    structuredContent: { error: { code: 'AIE_LOGIN_REQUIRED' } },
  });
  expect(await client.callTool({ name: 'get_scan_status' })).toMatchObject({
    isError: true,
    structuredContent: { error: { code: 'LOCAL_BUNDLE_REQUIRED' } },
  });
  expect((await client.readResource({ uri: localCatalog.resources[0].uri })).contents[0]).toMatchObject({
    text: 'fixture',
  });
  expect(
    (await client.getPrompt({ name: 'secure_coding_session', arguments: { mode: 'fixture' } })).messages[0].content,
  ).toMatchObject({ text: 'fixture' });
  expect(call).toHaveBeenCalledTimes(1);
  expect(resource).toHaveBeenCalledOnce();
  expect(prompt).toHaveBeenCalledWith('secure_coding_session', { mode: 'fixture' });
  await runtime.close();
  await runtime.close();
  expect(localClose).toHaveBeenCalledTimes(1);
});

it('closes both runtimes even when one cleanup fails', async () => {
  const aie = new AieDispatcher(undefined, { invocation: vi.fn(), action: vi.fn(), close: async () => undefined });
  const local = new LocalRuntime();
  const close = vi.spyOn(local, 'close').mockResolvedValue();
  vi.spyOn(aie, 'close').mockRejectedValue(new Error('fixture cleanup failure'));
  const runtime = createMcpServer(aie, local);
  await expect(runtime.close()).rejects.toThrow('fixture cleanup failure');
  expect(close).toHaveBeenCalledOnce();
});
