import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { installCommand } from './commands/install.js';
import { configureCommand } from './commands/configure.js';
import { updateCommand } from './commands/update.js';
import { statusCommand } from './commands/status.js';
import { uninstallCommand } from './commands/uninstall.js';
import { logger } from './utils/logger.js';
import { getPackageVersion } from './utils/packageMetadata.js';

type CommandSpec = {
  name: string;
  description: string;
  action: () => void | Promise<void>;
  allowUnknownOption?: boolean;
};

const COMMAND_SPECS: readonly CommandSpec[] = [
  { name: 'start', description: 'Start the MCP proxy', action: startCommand, allowUnknownOption: true },
  { name: 'install', description: 'Download and install the analyzer bundle', action: installCommand },
  { name: 'configure', description: 'Configure MCP servers and hooks for supported agents', action: configureCommand },
  { name: 'update', description: 'Update the analyzer bundle without prompting', action: updateCommand },
  { name: 'status', description: 'Show bundle and agent configuration status', action: statusCommand },
  { name: 'uninstall', description: 'Remove the analyzer bundle and agent configuration', action: uninstallCommand },
];

export function createProgram(): Command {
  const program = new Command();
  program
    .name('ptai-mcp')
    .description('Standalone CLI launcher for PT Application Inspector MCP proxy')
    .version(getPackageVersion())
    .showHelpAfterError();

  for (const spec of COMMAND_SPECS) {
    const command = program.command(spec.name).description(spec.description);
    if (spec.allowUnknownOption) command.allowUnknownOption();
    command.action(spec.action);
  }
  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  if (!argv.slice(2).length) {
    program.outputHelp();
    return;
  }
  try {
    await program.parseAsync(argv);
  } catch (error) {
    logger.error(`${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
