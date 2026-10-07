import { beforeEach, describe, expect, it, vi } from 'vitest';

const multiselect = vi.fn();
const select = vi.fn();
const confirm = vi.fn();
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
  select,
  confirm,
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
const writeCustomAgentGuide = vi.fn(async () => 'C:/home/.ptai-mcp/PT_AI_Custom_Agent_Setup.md');
const openCustomAgentGuide = vi.fn(async () => undefined);
vi.mock('../src/agents/customAgent.js', () => ({
  CUSTOM_AGENT_ID: '__custom_agent__',
  writeCustomAgentGuide,
  openCustomAgentGuide,
}));

const { BACK_TO_MCP_SELECTION, configureCommand, getConfigurationStatus } =
  await import('../src/commands/configure.js');

describe('configure command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue(true);
    supportedAgents = agents;
    detectedAgentIds = new Set(agents.map((agent) => agent.id));
    isMcpConfigured.mockImplementation(async (agent: { id: string }) => agent.id === 'alpha');
    isHooksConfigured.mockImplementation(async (agent: { id: string }) => agent.id === 'alpha');
  });

  it('configures selected MCP and hooks and removes deselected entries', async () => {
    // Arrange
    isMcpConfigured.mockResolvedValue(true);
    multiselect.mockReset().mockResolvedValueOnce(['alpha']).mockResolvedValueOnce(['alpha']);
    select.mockReset().mockResolvedValue('__configure_hooks__');

    // Act
    await configureCommand();

    // Assert
    expect(configureMcp).toHaveBeenCalledWith(agents[0], 'alpha.json');
    expect(removeMcp).toHaveBeenCalledWith(agents[1], 'beta.json');
    expect(configureHooks).toHaveBeenCalledWith(agents[0], 'proxy.exe');
    expect(multiselect.mock.calls[0][0].initialValues).toEqual(['alpha', 'beta']);
    expect(multiselect.mock.calls[1][0].initialValues).toEqual(['alpha']);
    expect(log.success).toHaveBeenCalled();
  });

  it('shows only detected agents and offers hooks only for selected MCP agents', async () => {
    // Arrange
    detectedAgentIds = new Set(['alpha']);
    multiselect.mockReset().mockResolvedValueOnce(['alpha']).mockResolvedValueOnce([]);
    select.mockReset().mockResolvedValue('__configure_hooks__');

    // Act
    await configureCommand();

    // Assert
    expect(multiselect).toHaveBeenCalledTimes(2);
    expect(multiselect.mock.calls[0][0].options).toHaveLength(2);
    expect(multiselect.mock.calls[1][0].options).toHaveLength(1);
    expect(multiselect.mock.calls[1][0].options[0].value).toBe('alpha');

    detectedAgentIds = new Set(agents.map((agent) => agent.id));
  });

  it('can return from hooks selection to choose MCP agents again', async () => {
    // Arrange
    configureMcp.mockClear();
    multiselect.mockReset().mockResolvedValueOnce(['alpha']).mockResolvedValueOnce(['alpha']);
    select.mockReset().mockResolvedValueOnce(BACK_TO_MCP_SELECTION).mockResolvedValueOnce('__configure_hooks__');
    multiselect.mockResolvedValueOnce([]);

    // Act
    await configureCommand();

    // Assert
    expect(multiselect).toHaveBeenCalledTimes(3);
    expect(configureMcp).toHaveBeenCalledTimes(1);
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
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    multiselect.mockReset().mockResolvedValueOnce(['alpha']).mockResolvedValueOnce([]);
    select.mockReset().mockResolvedValue('__configure_hooks__');

    // Act
    await configureCommand();

    // Assert
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('read failed'));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('hook read failed'));
  });

  it('does not change files before returning from hook selection', async () => {
    multiselect.mockResolvedValueOnce(['alpha']).mockResolvedValueOnce(Symbol.for('cancel'));
    select.mockResolvedValue('__configure_hooks__');

    await configureCommand();

    expect(configureMcp).not.toHaveBeenCalled();
    expect(removeMcp).not.toHaveBeenCalled();
  });

  it('confirms an empty detected-agent selection and explains destructive cleanup', async () => {
    multiselect.mockResolvedValueOnce([]).mockResolvedValueOnce(Symbol.for('cancel'));
    confirm.mockResolvedValueOnce(false);

    await configureCommand();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Existing PTAI entries will be removed') }),
    );
    expect(configureMcp).not.toHaveBeenCalled();
  });

  it('generates and offers to open the custom agent guide', async () => {
    multiselect.mockResolvedValueOnce(['__custom_agent__']);
    confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await configureCommand();

    expect(writeCustomAgentGuide).toHaveBeenCalledOnce();
    expect(openCustomAgentGuide).toHaveBeenCalledOnce();
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
