import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { localCatalog } from '../src/local/catalog.js';
import { LocalRuntime } from '../src/local/runtime.js';
import { LocalToolName } from '../src/local/tool-names.js';

const fake = vi.hoisted(() => ({
  exists: true,
  version: '3.0.1.1549-develop',
  clients: [] as Array<{ onclose?: () => void }>,
  connect: vi.fn(async (): Promise<void> => undefined),
  close: vi.fn(async () => undefined),
  request: vi.fn(),
  tools: vi.fn(),
  resources: vi.fn(),
  templates: vi.fn(),
  prompts: vi.fn(),
  readResource: vi.fn(),
  getPrompt: vi.fn(),
  resume: vi.fn(),
}));
vi.mock('node:fs', () => ({ default: { existsSync: () => fake.exists } }));
vi.mock('../src/utils/paths.js', () => ({
  getProxyPath: () => '/synthetic/McpProxy',
  readVersionsJson: () => (fake.version ? { 'AI.INFRASTRUCTURE.INSTALLATOR': fake.version } : null),
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {

    public stderr = { on: fake.resume };
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {

    public onclose?: () => void;
    public constructor() {
      fake.clients.push(this);
    }
    public connect = fake.connect;
    public close = fake.close;
    public request = fake.request;
    public listTools = fake.tools;
    public listResources = fake.resources;
    public listResourceTemplates = fake.templates;
    public listPrompts = fake.prompts;
    public readResource = fake.readResource;
    public getPrompt = fake.getPrompt;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  fake.clients.length = 0;
  fake.exists = true;
  fake.version = '3.0.1.1549-develop';
  fake.tools.mockResolvedValue({ tools: localCatalog.tools });
  fake.resources.mockResolvedValue({ resources: localCatalog.resources });
  fake.templates.mockResolvedValue({ resourceTemplates: localCatalog.resourceTemplates });
  fake.prompts.mockResolvedValue({ prompts: localCatalog.prompts });
  fake.request.mockResolvedValue({ content: [{ type: 'text', text: 'fixture' }] });
  fake.connect.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
const params = { name: 'get_scan_status', arguments: {} };

it('keeps the named local tools complete and distinguishes triggering from stopping a scan', () => {
  expect(Object.values(LocalToolName).sort()).toEqual(localCatalog.tools.map((tool) => tool.name).sort());
  expect(LocalToolName.TriggerScan).toBe('trigger_scan');
  expect(LocalToolName.StopScan).toBe('stop_scan');
});

it('connects once on demand, accepts matching schemas regardless of bundle build, and forwards resources/prompts', async () => {
  const runtime = new LocalRuntime(['--fixture']);
  expect(fake.connect).not.toHaveBeenCalled();
  await Promise.all([runtime.call(params), runtime.call(params)]);
  expect(fake.connect).toHaveBeenCalledTimes(1);
  expect(fake.request).toHaveBeenCalledWith({ method: 'tools/call', params }, expect.anything(), {
    timeout: 1_800_000,
  });
  await runtime.readResource('ptai://scans/status');
  await runtime.getPrompt('secure_coding_session', { mode: 'test' });
  expect(fake.readResource).toHaveBeenCalledWith({ uri: 'ptai://scans/status' });
  expect(fake.getPrompt).toHaveBeenCalledWith({ name: 'secure_coding_session', arguments: { mode: 'test' } });
  await runtime.close();
  expect(fake.close).toHaveBeenCalledOnce();
  await expect(runtime.call(params)).rejects.toMatchObject({ code: 'LOCAL_PROXY_DISCONNECTED' });
});
it('distinguishes missing, incomplete and incompatible bundles without spawning a child', async () => {
  const runtime = new LocalRuntime();
  fake.exists = false;
  fake.version = '';
  await expect(runtime.call(params)).rejects.toMatchObject({ code: 'LOCAL_BUNDLE_REQUIRED' });
  fake.version = '3.0.1.1549';
  await expect(runtime.call(params)).rejects.toMatchObject({ code: 'LOCAL_BUNDLE_INCOMPATIBLE' });
  await expect(runtime.call({ name: 'unknown' })).rejects.toMatchObject({ code: 'LOCAL_TOOL_UNKNOWN' });
  expect(fake.connect).not.toHaveBeenCalled();
});
it.each(['tools', 'resources', 'prompts'] as const)(
  'rejects an incompatible %s catalog and closes the child',
  async (kind) => {
    fake[kind].mockResolvedValue({ [kind]: [] });
    await expect(new LocalRuntime().call(params)).rejects.toMatchObject({ code: 'LOCAL_BUNDLE_INCOMPATIBLE' });
    expect(fake.close).toHaveBeenCalledOnce();
  },
);
it('recovers after a child exit, while reporting an interrupted mutation as unknown', async () => {
  const runtime = new LocalRuntime();
  await runtime.call(params);
  fake.clients[0].onclose?.();
  fake.request.mockRejectedValueOnce(new Error('fixture child exit'));
  await expect(runtime.call(params)).rejects.toMatchObject({
    code: 'LOCAL_PROXY_DISCONNECTED',
    details: { effects: 'unknown' },
  });
  expect(fake.connect).toHaveBeenCalledTimes(2);
  await runtime.close();
});
it('reports a failed startup safely and can retry the next explicit invocation', async () => {
  const runtime = new LocalRuntime();
  fake.connect.mockRejectedValueOnce(new Error('private-path'));
  await expect(runtime.call(params)).rejects.toMatchObject({ code: 'LOCAL_PROXY_START_FAILED' });
  await expect(runtime.call(params)).resolves.toMatchObject({ content: [{ text: 'fixture' }] });
  await runtime.close();
});
it('waits for an in-flight connection during shutdown and closes the resulting child', async () => {
  let release!: () => void;
  fake.connect.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const runtime = new LocalRuntime();
  const call = runtime.call(params);
  const closing = runtime.close();
  release();
  await call;
  await closing;
  expect(fake.close).toHaveBeenCalledOnce();
});
