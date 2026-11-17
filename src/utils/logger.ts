import { log } from '@clack/prompts';
import { DiagnosticLevel } from './constants.js';

export const logger = {
  info: (message: string) => log.info(message),
  warn: (message: string) => writeDiagnostic(DiagnosticLevel.Warning, message),
  error: (message: string) => writeDiagnostic(DiagnosticLevel.Error, message),
  success: (message: string) => log.success(message),
  step: (message: string) => log.step(message),
};

function writeDiagnostic(level: (typeof DiagnosticLevel)[keyof typeof DiagnosticLevel], message: string): void {
  process.stderr.write(`${level === DiagnosticLevel.Warning ? 'Warning' : 'Error'}: ${message}\n`);
}
