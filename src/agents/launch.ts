export const MCP_PACKAGE_NAME = '@posidev-community/ptai-mcp';

const MCP_PROXY_PATTERN = /(?:^|[\\/])McpProxy(?:\.exe)?(?:$|[\s"'&])/i;

export interface LaunchSpec {
  command: string;
  args: string[];
}

export function packageLaunch(subcommand = 'start'): LaunchSpec {
  return {
    command: 'npx',
    args: ['-y', MCP_PACKAGE_NAME, subcommand],
  };
}

export function bundleLaunch(proxyPath: string, args: string[] = []): LaunchSpec {
  return { command: proxyPath, args };
}

/**
 * Recognize the supported package and bundled-binary forms of the PT AI
 * launcher without inspecting unrelated metadata fields in the server entry.
 */
export function isPtaiMcpLaunch(server: Record<string, unknown> | undefined): boolean {
  if (!server || typeof server.command !== 'string' || server.command.trim() === '') return false;

  const args = Array.isArray(server.args)
    ? server.args.filter((value): value is string => typeof value === 'string')
    : [];
  const commandParts = [server.command, ...args];
  const command = server.command.trim();
  const commandName = command.replace(/^.*[\\/]/, '').toLowerCase();

  const packageForm = (commandName === 'npx' || commandName === 'npx.cmd') && args.includes(MCP_PACKAGE_NAME);
  const bundleForm = commandParts.some((part) => MCP_PROXY_PATTERN.test(part));
  return packageForm || bundleForm;
}

export function isOurHookCommand(command: string, identifier: string): boolean {
  const normalized = command.trim();
  if (!normalized.endsWith(identifier)) return false;
  return normalized.includes(MCP_PACKAGE_NAME) || MCP_PROXY_PATTERN.test(normalized);
}

export function hookCommand(spec: LaunchSpec): string {
  const command = `${spec.command} ${spec.args.join(' ')}`;
  return process.platform === 'win32' ? `"${spec.command}" ${spec.args.join(' ')}` : command;
}

export function windowsHookCommand(spec: LaunchSpec): string {
  return `powershell.exe -NoProfile -NonInteractive -Command "& '${spec.command.replaceAll("'", "''")}' ${spec.args.join(' ')}"`;
}
