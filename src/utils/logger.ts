import { log } from '@clack/prompts';

function writeDiagnostic(level: 'warning' | 'error', message: string): void {
  process.stderr.write(`${level === 'warning' ? 'Warning' : 'Error'}: ${message}\n`);
}

export const logger = {
  info: (message: string) => log.info(message),
  warn: (message: string) => writeDiagnostic('warning', message),
  error: (message: string) => writeDiagnostic('error', message),
  success: (message: string) => log.success(message),
  step: (message: string) => log.step(message),
};
