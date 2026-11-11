export type Effects = 'not_applied' | 'applied' | 'partial' | 'unknown';

export class AieError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: {
      retryable?: boolean;
      next_action?: string;
      effects?: Effects;
      target?: Record<string, unknown>;
      http_status?: number;
      server_code?: string;
      invalid_fields?: string[];
    } = {},
  ) {
    super(message);
    this.name = 'AieError';
  }
}

export function validation(message: string): never {
  throw new AieError('AIE_VALIDATION_ERROR', message, { effects: 'not_applied' });
}

export function safeError(error: unknown, operation: string) {
  const known = error instanceof AieError;
  return {
    code: known ? error.code : 'AIE_INTERNAL_ERROR',
    message: known ? error.message : 'Operation failed. Internal details are omitted to protect credentials.',
    operation,
    retryable: known ? (error.details.retryable ?? false) : false,
    next_action: known
      ? (error.details.next_action ?? 'Inspect the target before retrying a change.')
      : 'Inspect the target and report the failure.',
    ...(known ? error.details : {}),
  };
}
