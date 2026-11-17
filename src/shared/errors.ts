import { Effects } from './effects.js';
import { ErrorCode } from './error-codes.js';
import type { JsonObject } from './json.js';

export class ToolError extends Error {

  public constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details: {
      retryable?: boolean;
      next_action?: string;
      effects?: Effects;
      target?: Record<string, unknown>;
      http_status?: number;
      server_code?: string;
      invalid_fields?: string[];
      failed_check?: string;
      expected?: unknown;
      actual?: unknown;
      tls?: JsonObject;
    } = {},
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

export function validation(message: string): never {
  throw new ToolError(ErrorCode.ValidationError, message, { effects: Effects.NotApplied });
}

export function safeError(error: unknown, operation: string) {
  const known = error instanceof ToolError;

  return {
    code: known ? error.code : ErrorCode.InternalError,
    message: known ? error.message : 'Operation failed. Internal details are omitted to protect credentials.',
    operation,
    retryable: known ? (error.details.retryable ?? false) : false,
    next_action: known
      ? (error.details.next_action ?? 'Inspect the target before retrying a change.')
      : 'Inspect the target and report the failure.',
    ...(known ? error.details : {}),
  };
}
