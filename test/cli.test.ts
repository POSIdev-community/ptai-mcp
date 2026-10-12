import { describe, expect, it, vi } from 'vitest';
import { createProgram, runCli } from '../src/cli.js';

const { commands } = vi.hoisted(() => ({
  commands: {
    start: vi.fn(),
    install: vi.fn(async () => undefined),
    configure: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    status: vi.fn(async () => undefined),
    uninstall: vi.fn(async () => undefined),
  },
}));
vi.mock('../src/commands/start.js', () => ({ startCommand: commands.start }));
vi.mock('../src/commands/install.js', () => ({ installCommand: commands.install }));
vi.mock('../src/commands/configure.js', () => ({ configureCommand: commands.configure }));
vi.mock('../src/commands/update.js', () => ({ updateCommand: commands.update }));
vi.mock('../src/commands/status.js', () => ({ statusCommand: commands.status }));
vi.mock('../src/commands/uninstall.js', () => ({ uninstallCommand: commands.uninstall }));

describe('CLI', () => {
  it('registers every public command and package metadata', () => {
    // Arrange
    const program = createProgram();

    // Act & Assert
    expect(program.name()).toBe('ptai-mcp');
    expect(program.commands.map((command) => command.name())).toEqual([
      'start',
      'install',
      'configure',
      'update',
      'status',
      'uninstall',
    ]);
  });

  it.each([
    ['start', commands.start],
    ['install', commands.install],
    ['configure', commands.configure],
    ['update', commands.update],
    ['status', commands.status],
    ['uninstall', commands.uninstall],
  ])('dispatches %s', async (name, handler) => {
    // Arrange
    const program = createProgram();

    // Act
    await program.parseAsync(['node', 'ptai-mcp', name], { from: 'node' });

    // Assert
    expect(handler).toHaveBeenCalled();
  });

  it('shows help when invoked without a command', async () => {
    // Arrange
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Act
    await runCli(['node', 'ptai-mcp']);

    // Assert
    expect(write).toHaveBeenCalled();
    write.mockRestore();
  });

  it.each([
    ['unknown command', ['node', 'ptai-mcp', 'unknown-command']],
    ['unknown option', ['node', 'ptai-mcp', 'status', '--unknown-option']],
  ])('shows help after an %s error', async (_name, argv) => {
    const output: string[] = [];
    const program = createProgram()
      .exitOverride()
      .configureOutput({ writeErr: (value) => output.push(value), writeOut: (value) => output.push(value) });

    await expect(program.parseAsync(argv, { from: 'node' })).rejects.toThrow();

    expect(output.join('')).toContain('Usage:');
  });
});
