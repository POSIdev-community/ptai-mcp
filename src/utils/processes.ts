import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export type ProcessRunner = (file: string, args: string[], options?: { windowsHide?: boolean }) => Promise<unknown>;

export interface ProcessStopResult {
  stopped: string[];
  notRunning: string[];
}

/**
 * Stop the analyzer processes before replacing the installed bundle.
 * A process that is not running is intentionally treated as success.
 */
export async function killAnalyzerProcesses(run: ProcessRunner = execFileAsync): Promise<ProcessStopResult> {
  const processNames =
    process.platform === 'win32' ? ['AI.PluginsBackend.exe', 'McpProxy.exe'] : ['AI.PluginsBackend', 'McpProxy'];
  const result: ProcessStopResult = { stopped: [], notRunning: [] };

  for (const processName of processNames) {
    try {
      if (process.platform === 'win32') {
        await run('taskkill', ['/F', '/T', '/IM', processName], {
          windowsHide: true,
        });
      } else {
        await run('pkill', ['-f', processName]);
      }
      result.stopped.push(processName);
    } catch (error) {
      if (isProcessNotFound(error)) {
        result.notRunning.push(processName);
        continue;
      }
      throw new Error(`Failed to stop analyzer process ${processName}: ${formatError(error)}`, { cause: error });
    }
  }

  return result;
}

function isProcessNotFound(error: unknown): boolean {
  const code = String((error as NodeJS.ErrnoException | undefined)?.code ?? '');
  if (process.platform === 'win32') return code === '128';
  return code === '1';
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
