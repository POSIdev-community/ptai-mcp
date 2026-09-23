import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export type ProcessRunner = (file: string, args: string[], options?: { windowsHide?: boolean }) => Promise<unknown>;

/**
 * Stop the analyzer processes before replacing the installed bundle.
 * A process that is not running is intentionally treated as success.
 */
export async function killAnalyzerProcesses(run: ProcessRunner = execFileAsync): Promise<void> {
  const processNames =
    process.platform === 'win32' ? ['AI.PluginsBackend.exe', 'McpProxy.exe'] : ['AI.PluginsBackend', 'McpProxy'];

  for (const processName of processNames) {
    try {
      if (process.platform === 'win32') {
        await run('taskkill', ['/F', '/IM', processName], {
          windowsHide: true,
        });
      } else {
        await run('pkill', ['-f', processName]);
      }
    } catch {
      // taskkill/pkill exits non-zero when no matching process exists.
    }
  }
}
