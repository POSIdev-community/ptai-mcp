import { Platform } from '../../utils/platform-constants.js';
import {
  bundleLaunch,
  hookCommand as formatHookCommand,
  windowsHookCommand as formatWindowsHookCommand,
} from '../launch.js';

export function hookCommand(proxyPath: string, format: string, start = false): string {
  return formatHookCommand(bundleLaunch(proxyPath, [start ? 'hook-start' : 'hook', '--format', format]));
}

export function windowsHookCommand(proxyPath: string, format: string, start = false): string {
  return formatWindowsHookCommand(bundleLaunch(proxyPath, [start ? 'hook-start' : 'hook', '--format', format]));
}

export function windsurfEntry(proxyPath: string, format: string, start = false): Record<string, unknown> {
  const entry: Record<string, unknown> = { show_output: !start };

  if (process.platform === Platform.Windows) {
    entry.powershell = hookCommand(proxyPath, format, start);
    entry.command = `${proxyPath} ${start ? 'hook-start' : 'hook'} --format ${format}`;
  } else {
    entry.command = hookCommand(proxyPath, format, start);
  }

  return entry;
}

export function hookInput(format: string): Record<string, string> {
  return { source: 'hook', mode: 'incremental', hookFormat: format, stopHookActive: '${stop_hook_active}' };
}
