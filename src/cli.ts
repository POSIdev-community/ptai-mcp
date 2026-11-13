import { Command } from 'commander';
import { configureCommand } from './commands/configure.js';
import { installCommand } from './commands/install.js';
import { CommandName } from './commands/models.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { uninstallCommand } from './commands/uninstall.js';
import { updateCommand } from './commands/update.js';
import { logger } from './utils/logger.js';
import { getPackageVersion } from './utils/packageMetadata.js';

const COMMAND_SPECS: readonly CommandSpec[] = [
  {
    name: CommandName.Start,
    description: 'Start the MCP server with local and AIE tools',
    action: startCommand,
    allowUnknownOption: true,
  },
  {
    name: CommandName.Install,
    description: 'Set up MCP with an optional local analyzer bundle',
    action: installCommand,
  },
  {
    name: CommandName.Configure,
    description: 'Configure MCP servers and hooks for supported agents',
    action: configureCommand,
  },
  { name: CommandName.Update, description: 'Update the analyzer bundle without prompting', action: updateCommand },
  { name: CommandName.Status, description: 'Show bundle and agent configuration status', action: statusCommand },
  {
    name: CommandName.Uninstall,
    description: 'Remove the analyzer bundle and agent configuration',
    action: uninstallCommand,
  },
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

    if (spec.allowUnknownOption) {
      command.allowUnknownOption();
    }

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

type CommandSpec = {
  name: string;
  description: string;
  action: () => void | Promise<void>;
  allowUnknownOption?: boolean;
};
