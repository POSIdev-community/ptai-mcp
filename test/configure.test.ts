import { describe, expect, it, vi } from 'vitest';

const multiselect = vi.fn();
const log = { info: vi.fn(), success: vi.fn(), warn: vi.fn() };
const configureMcp = vi.fn(async () => ({ paths: ['config'] }));
const removeMcp = vi.fn(async () => undefined);
const isMcpConfigured = vi.fn(async (agent: { id: string }) => agent.id === 'alpha');
const configureHooks = vi.fn(async () => undefined);
const removeHooks = vi.fn(async () => undefined);
const isHooksConfigured = vi.fn(async (agent: { id: string }) => agent.id === 'alpha');
const agents = [
  {
    id: 'alpha',
    displayName: 'Alpha',
    supportsHooks: true,
    getMcpConfigPaths: () => ['alpha.json'],
    getHooksConfigPaths: () => ['alpha-hooks.json'],
  },
  {
    id: 'beta',
    displayName: 'Beta',
    supportsHooks: false,
    getMcpConfigPaths: () => ['beta.json'],
    getHooksConfigPaths: () => [],
  },
];
let supportedAgents = agents;
let detectedAgentIds = new Set(agents.map((agent) => agent.id));

vi.mock('@clack/prompts', () => ({
  multiselect,
  isCancel: (value: unknown) => value === Symbol.for('cancel'),
  log,
}));
vi.mock('../src/agents/registry.js', () => ({
  getSupportedAgents: () => supportedAgents,
  isAgentDetected: (agent: { id: string }) => detectedAgentIds.has(agent.id),
}));
vi.mock('../src/agents/mcpConfig.js', () => ({ configureMcp, removeMcp, isMcpConfigured }));
vi.mock('../src/agents/hooksConfig.js', () => ({ configureHooks, removeHooks, isHooksConfigured }));
vi.mock('../src/utils/paths.js', () => ({ getProxyPath: () => 'proxy.exe' }));

const { BACK_TO_MCP_SELECTION, configureCommand, getConfigurationStatus } =
  await import('../src/commands/configure.js');

describe('configure command', () => {
  it('configures selected MCP and hooks and removes deselected entries', async () => {
    // Arrange
    isMcpConfigured.mockResolvedValue(true);
    multiselect.mockReset().mockResolvedValueOnce(['alpha']).mockResolvedValueOnce(['alpha']);

    // Act
    await configureCommand();

    // Assert
    expect(configureMcp).toHaveBeenCalledWith(agents[0], 'alpha.json');
    expect(removeMcp).toHaveBeenCalledWith(agents[1], 'beta.json');
    expect(configureHooks).toHaveBeenCalledWith(agents[0], 'proxy.exe');
    expect(log.success).toHaveBeenCalled();
  });

  it('shows only detected agents and offers hooks only for selected MCP agents', async () => {
    // Arrange
    detectedAgentIds = new Set(['alpha']);
    multiselect.mockReset().mockResolvedValueOnce(['alpha']).mockResolvedValueOnce([]);

    // Act
    await configureCommand();

    // Assert
    expect(multiselect).toHaveBeenCalledTimes(2);
    expect(multiselect.mock.calls[0][0].options).toHaveLength(1);
    expect(multiselect.mock.calls[1][0].options).toHaveLength(2);
    expect(multiselect.mock.calls[1][0].options[1].value).toBe('alpha');

    detectedAgentIds = new Set(agents.map((agent) => agent.id));
  });

  it('can return from hooks selection to choose MCP agents again', async () => {
    // Arrange
    configureMcp.mockClear();
    multiselect.mockReset().mockResolvedValueOnce(['alpha']).mockResolvedValueOnce([BACK_TO_MCP_SELECTION]);
    multiselect.mockResolvedValueOnce(['alpha']).mockResolvedValueOnce([]);

    // Act
    await configureCommand();

    // Assert
    expect(multiselect).toHaveBeenCalledTimes(4);
    expect(configureMcp).toHaveBeenCalledTimes(2);
  });

  it('stops when MCP selection is cancelled', async () => {
    // Arrange
    configureMcp.mockClear();
    multiselect.mockReset().mockResolvedValueOnce(Symbol.for('cancel'));

    // Act
    await configureCommand();

    // Assert
    expect(configureMcp).not.toHaveBeenCalled();
  });

  it('reports configuration status', async () => {
    // Arrange
    isMcpConfigured.mockImplementation(async (agent: { id: string }) => agent.id === 'alpha');

    // Act
    const result = await getConfigurationStatus();

    // Assert
    expect(result).toEqual([
      { agent: agents[0], mcp: true, hooks: true },
      { agent: agents[1], mcp: false, hooks: false },
    ]);
  });

  it('handles hook cancellation and cleanup errors', async () => {
    // Arrange
    isMcpConfigured.mockResolvedValue(false);
    multiselect.mockReset().mockResolvedValueOnce(Symbol.for('cancel'));

    // Act
    await configureCommand();

    // Assert
    expect(log.info).toHaveBeenCalledWith('Configuration cancelled.');

    // Arrange
    isMcpConfigured.mockRejectedValue(new Error('read failed'));
    isHooksConfigured.mockRejectedValue('hook read failed');
    multiselect.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    // Act
    await configureCommand();

    // Assert
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('read failed'));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('hook read failed'));
  });

  it('rejects configuration on an unsupported platform', async () => {
    // Arrange
    supportedAgents = [];

    // Act & Assert
    await expect(configureCommand()).rejects.toThrow('Unsupported OS');

    // Cleanup
    supportedAgents = agents;
    detectedAgentIds = new Set(agents.map((agent) => agent.id));
  });
});
