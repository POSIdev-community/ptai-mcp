import { spawn } from 'node:child_process';
import { ProcessStdio } from '../../shared/io-constants.js';
import { Platform } from '../../utils/platform-constants.js';

const browserCommands: Partial<Record<NodeJS.Platform, string>> = {
  [Platform.Windows]: 'rundll32.exe',
  [Platform.MacOS]: 'open',
};

export function browserOpen(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const command = browserCommands[process.platform] ?? 'xdg-open';
    const args = process.platform === Platform.Windows ? ['url.dll,FileProtocolHandler', url] : [url];
    const child = spawn(command, args, { stdio: ProcessStdio.Ignore, windowsHide: true, detached: true });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
