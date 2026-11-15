import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import { schemas as observed63 } from '../../vendor/aie-v63/observed.js';
import { ApiErrorType } from '../../vendor/aie-v63/src/models/index.js';
import { FetchError } from '../../vendor/aie-v63/src/runtime.js';
import { schemas as schemas64 } from '../../vendor/aie-v64/contract.js';
import { boundedBody } from './body.js';

const knownServerCodes = new Set<string>([
  ...Object.values(ApiErrorType),
  ...(observed63.ApiErrorType.enum as string[]),
  ...(schemas64.ApiErrorType.enum as string[]),
]);

const statusCodes = new Map<number, ErrorCode>([
  [400, ErrorCode.ValidationError],
  [401, ErrorCode.LoginRequired],
  [403, ErrorCode.PermissionDenied],
  [404, ErrorCode.NotFound],
  [409, ErrorCode.Conflict],
  [422, ErrorCode.ValidationError],
  [429, ErrorCode.RateLimited],
]);

export function networkError(error: unknown, changing: boolean): ToolError {
  if (error instanceof ToolError) {
    return error;
  }

  if (error instanceof FetchError) {
    return networkError(error.cause, changing);
  }

  const failure = networkFailure(error);

  return new ToolError(failure.code, failure.message, {
    effects: changing ? Effects.Unknown : Effects.NotApplied,
    retryable: !changing,
    next_action: changing
      ? 'Read the target state before repeating this change.'
      : 'Check connectivity and trusted CA/proxy configuration.',
  });
}

export async function httpError(response: Response, changing: boolean): Promise<ToolError> {
  const { serverCode, invalidFields } = await readFailureDetails(response);
  const status = response.status;
  const code = httpFailureCode(status, serverCode);

  return new ToolError(code, `AIE rejected the request (HTTP ${status}).`, {
    http_status: status,
    effects: changing && status >= 500 ? Effects.Unknown : Effects.NotApplied,
    server_code: knownServerCodes.has(serverCode) ? serverCode : undefined,
    invalid_fields: invalidFields.length ? invalidFields : undefined,
    retryable: !changing && (status === 429 || status >= 500),
    next_action: nextAction(status, code, serverCode),
  });
}

function networkFailure(error: unknown): Failure {
  const cause = error instanceof Error ? error : undefined;
  let code: unknown;

  if (cause && 'code' in cause) {
    code = cause.code;
  } else if (cause?.cause && typeof cause.cause === 'object' && 'code' in cause.cause) {
    code = cause.cause.code;
  }

  if (
    typeof code === 'string' &&
    /CERT|TLS|SSL|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER|DEPTH_ZERO_SELF_SIGNED/.test(code)
  ) {
    return {
      code: ErrorCode.TlsError,
      message: 'TLS certificate verification failed. Configure a trusted CA for the Node transport.',
    };
  }

  if (cause?.name === 'TimeoutError') {
    return { code: ErrorCode.Timeout, message: 'The AIE request timed out.' };
  }

  if (cause?.name === 'AbortError') {
    return { code: ErrorCode.Cancelled, message: 'The request was cancelled.' };
  }

  return { code: ErrorCode.NetworkError, message: 'Could not complete the AIE request.' };
}

function httpFailureCode(status: number, serverCode: string): ErrorCode {
  if (/licen[cs]e/i.test(serverCode)) {
    return ErrorCode.LicenseError;
  }

  if (status !== 401 && status !== 403 && /_(?:NOT_FOUND|NOT_EXISTS)$/.test(serverCode)) {
    return ErrorCode.NotFound;
  }

  return statusCodes.get(status) ?? ErrorCode.ServerError;
}

function nextAction(status: number, code: ErrorCode, serverCode: string): string {
  if (status === 401) {
    return 'Call aie_auth(action=login), then explicitly repeat the operation.';
  }

  if (code === ErrorCode.LicenseError) {
    return 'Check the server license.';
  }

  if (status === 403) {
    return 'Check the current server permissions.';
  }

  if (serverCode === 'INVALID_LANGUAGE_FOR_RACE_CONDITION') {
    return 'Check the languages supported by RaceConditionDetection on this AIE build and the selected project languages.';
  }

  if (serverCode === 'ASINT_NAIRA_INTEGRATION_DISABLED') {
    return 'Ask the AIE administrator to enable the Asint/Naira integration, or disable that option in project settings.';
  }

  return 'Inspect the target and request parameters.';
}

async function readFailureDetails(response: Response) {
  try {
    const value: unknown = JSON.parse((await boundedBody(response, 64 * 1024)).toString('utf8'));

    if (!value || typeof value !== 'object') {
      return { serverCode: '', invalidFields: [] };
    }

    const source = value as Record<string, unknown>;
    const serverCode = String(source.errorCode ?? source.code ?? '');
    const fields = source.errors ?? (serverCode === ApiErrorType.InvalidJsonFields ? source.details : undefined);
    const invalidFields =
      fields && typeof fields === 'object'
        ? Object.keys(fields)
            .filter((key) => /^[A-Za-z][A-Za-z0-9_.[\]]{0,120}$/.test(key))
            .slice(0, 12)
        : [];

    return { serverCode, invalidFields };
  } catch {
    // Raw upstream messages may contain credentials; never expose them.
    return { serverCode: '', invalidFields: [] };
  }
}

interface Failure {
  code: ErrorCode;
  message: string;
}
