import { log } from '@clack/prompts';

export const logger = {
  info: (message: string) => log.info(message),
  warn: (message: string) => log.warn(message),
  error: (message: string) => log.error(message),
  success: (message: string) => log.success(message),
  step: (message: string) => log.step(message),
};
