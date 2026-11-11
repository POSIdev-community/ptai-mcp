import { Configuration, FetchError, type ApiResponse } from '../vendor/aie-v63/src/runtime.js';
import { AuthApi } from '../vendor/aie-v63/src/apis/AuthApi.js';
import { ExternalAuthApi } from '../vendor/aie-v63/src/apis/ExternalAuthApi.js';
import { InitiatorApi } from '../vendor/aie-v63/src/apis/InitiatorApi.js';
import { UserApi } from '../vendor/aie-v63/src/apis/UserApi.js';
import { VersionApi } from '../vendor/aie-v63/src/apis/VersionApi.js';
import { ProjectsApi } from '../vendor/aie-v63/src/apis/ProjectsApi.js';
import { BranchesApi } from '../vendor/aie-v63/src/apis/BranchesApi.js';
import { StoreApi } from '../vendor/aie-v63/src/apis/StoreApi.js';
import { ConfigsApi } from '../vendor/aie-v63/src/apis/ConfigsApi.js';
import { PMGroupsApi } from '../vendor/aie-v63/src/apis/PMGroupsApi.js';
import { PmRuleVulnTypesApi } from '../vendor/aie-v63/src/apis/PmRuleVulnTypesApi.js';
import { AgentsApi } from '../vendor/aie-v63/src/apis/AgentsApi.js';
import { ScanQueueApi } from '../vendor/aie-v63/src/apis/ScanQueueApi.js';
import { ChangeHistoryApi } from '../vendor/aie-v63/src/apis/ChangeHistoryApi.js';
import { ApiErrorType } from '../vendor/aie-v63/src/models/index.js';
import { AieError, validation } from './errors.js';
import { LIMITS } from './limits.js';

export function serverUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return validation('AIE server_url must be an absolute HTTPS URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    validation('AIE server_url must be an HTTPS origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

export async function boundedBody(response: Response, maximum = LIMITS.jsonBytes): Promise<Buffer> {
  if (Number(response.headers.get('content-length')) > maximum) {
    await response.body?.cancel();
    throw new AieError('AIE_UPSTREAM_LIMIT', 'The server response exceeds the configured limit.');
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > maximum)
        throw new AieError('AIE_UPSTREAM_LIMIT', 'The server response exceeds the configured limit.');
      chunks.push(Buffer.from(item.value));
    }
    return Buffer.concat(chunks, bytes);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function networkError(error: unknown, changing: boolean): AieError {
  if (error instanceof AieError) return error;
  if (error instanceof FetchError) return networkError(error.cause, changing);
  const cause = error instanceof Error ? (error as Error & { code?: string; cause?: unknown }) : undefined;
  const code = cause?.code ?? (cause?.cause as { code?: string } | undefined)?.code ?? '';
  const tls = /CERT|TLS|SSL|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER|DEPTH_ZERO_SELF_SIGNED/.test(code);
  const timeout = cause?.name === 'TimeoutError';
  const cancelled = cause?.name === 'AbortError';
  return new AieError(
    tls ? 'AIE_TLS_ERROR' : timeout ? 'AIE_TIMEOUT' : cancelled ? 'AIE_CANCELLED' : 'AIE_NETWORK_ERROR',
    tls
      ? 'TLS certificate verification failed. Configure a trusted CA for the Node transport.'
      : cancelled
        ? 'The request was cancelled.'
        : timeout
          ? 'The AIE request timed out.'
          : 'Could not complete the AIE request.',
    {
      effects: changing ? 'unknown' : 'not_applied',
      retryable: !changing,
      next_action: changing
        ? 'Read the target state before repeating this change.'
        : 'Check connectivity and trusted CA/proxy configuration.',
    },
  );
}

async function httpError(response: Response, changing: boolean): Promise<AieError> {
  let serverCode = '';
  let invalidFields: string[] = [];
  try {
    const value = JSON.parse((await boundedBody(response, 64 * 1024)).toString('utf8')) as {
      errorCode?: unknown;
      code?: unknown;
      errors?: unknown;
      details?: unknown;
    };
    serverCode = String(value.errorCode ?? value.code ?? '');
    const fields = value.errors ?? (serverCode === 'INVALID_JSON_FIELDS' ? value.details : undefined);
    if (fields && typeof fields === 'object')
      invalidFields = Object.keys(fields)
        .filter((key) => /^[A-Za-z][A-Za-z0-9_.[\]]{0,120}$/.test(key))
        .slice(0, 12);
  } catch {
    /* Raw server messages may contain credentials; never expose them. */
  }
  const status = response.status;
  const license = /licen[cs]e/i.test(serverCode);
  const code = license
    ? 'AIE_LICENSE_ERROR'
    : status === 401
      ? 'AIE_LOGIN_REQUIRED'
      : status === 403
        ? 'AIE_PERMISSION_DENIED'
        : status === 404 || /_(?:NOT_FOUND|NOT_EXISTS)$/.test(serverCode)
          ? 'AIE_NOT_FOUND'
          : [400, 422].includes(status)
            ? 'AIE_VALIDATION_ERROR'
            : status === 409
              ? 'AIE_CONFLICT'
              : status === 429
                ? 'AIE_RATE_LIMITED'
                : 'AIE_SERVER_ERROR';
  return new AieError(code, `AIE rejected the request (HTTP ${status}).`, {
    http_status: status,
    effects: changing && status >= 500 ? 'unknown' : 'not_applied',
    server_code: (Object.values(ApiErrorType) as string[]).includes(serverCode) ? serverCode : undefined,
    invalid_fields: invalidFields.length ? invalidFields : undefined,
    retryable: !changing && (status === 429 || status >= 500),
    next_action:
      status === 401
        ? 'Call aie_auth(action=login), then explicitly repeat the operation.'
        : license
          ? 'Check the server license.'
          : status === 403
            ? 'Check the current server permissions.'
            : 'Inspect the target and request parameters.',
  });
}

/** All domain requests use the generated AI.Api.Client 6.3 client, never a tool-supplied URL. */
export class AieApi {
  private readonly changingResponses = new WeakSet<Response>();
  beforeRequest?: () => Promise<string>;
  recoverUnauthorized?: () => Promise<string>;
  readonly auth: AuthApi;
  readonly external: ExternalAuthApi;
  readonly initiator: InitiatorApi;
  readonly user: UserApi;
  readonly version: VersionApi;
  readonly projects: ProjectsApi;
  readonly branches: BranchesApi;
  readonly store: StoreApi;
  readonly configs: ConfigsApi;
  readonly groups: PMGroupsApi;
  readonly types: PmRuleVulnTypesApi;
  readonly agents: AgentsApi;
  readonly queue: ScanQueueApi;
  readonly history: ChangeHistoryApi;

  constructor(
    readonly origin: string,
    token?: string,
    request: typeof fetch = fetch,
  ) {
    const config = new Configuration({
      basePath: origin,
      apiKey: () => (token ? `Bearer ${token}` : ''),
      fetchApi: async (url, init) => {
        // Code exchange and signout are GET in the upstream contract but have effects.
        const changing = init?.method !== 'GET' || /signin\/complete|signout|refreshToken/.test(String(url));
        try {
          const prepared: RequestInit = {
            ...init,
            redirect: 'error',
            signal: init?.signal ?? AbortSignal.timeout(LIMITS.requestMs),
          };
          if (this.beforeRequest) {
            const latest = await this.beforeRequest();
            const headers = new Headers(prepared.headers);
            headers.set('Authorization', `Bearer ${latest}`);
            prepared.headers = headers;
          }
          let response = await request(url, prepared);
          if (response.status === 401 && this.recoverUnauthorized) {
            const latest = await this.recoverUnauthorized();
            if (!changing) {
              await response.body?.cancel();
              const headers = new Headers(prepared.headers);
              headers.set('Authorization', `Bearer ${latest}`);
              response = await request(url, { ...prepared, headers });
            }
            // A rejected mutation is never replayed automatically, even if the
            // common session was successfully recovered for the next call.
          }
          if (!response.ok) throw await httpError(response, changing);
          if (changing) this.changingResponses.add(response);
          return response;
        } catch (error) {
          throw networkError(error, changing);
        }
      },
    });
    this.auth = new AuthApi(config);
    this.external = new ExternalAuthApi(config);
    this.initiator = new InitiatorApi(config);
    this.user = new UserApi(config);
    this.version = new VersionApi(config);
    this.projects = new ProjectsApi(config);
    this.branches = new BranchesApi(config);
    this.store = new StoreApi(config);
    this.configs = new ConfigsApi(config);
    this.groups = new PMGroupsApi(config);
    this.types = new PmRuleVulnTypesApi(config);
    this.agents = new AgentsApi(config);
    this.queue = new ScanQueueApi(config);
    this.history = new ChangeHistoryApi(config);
  }

  async json<T>(call: Promise<ApiResponse<T>>): Promise<T> {
    let response: Response | undefined;
    try {
      response = (await call).raw;
      const body = await boundedBody(response);
      if (!body.length) return undefined as T;
      const text = body.toString('utf8');
      try {
        return JSON.parse(text) as T;
      } catch {
        // Several scalar 6.3 endpoints use text/plain (the generated Raw
        // methods normally select TextApiResponse for these).
        if (response.headers.get('content-type')?.toLowerCase().startsWith('text/plain')) return text as T;
        throw new AieError('AIE_INVALID_RESPONSE', 'AIE returned invalid JSON.');
      }
    } catch (error) {
      const changing = !!response && this.changingResponses.has(response);
      if (error instanceof AieError && changing)
        throw new AieError(error.code, error.message, { ...error.details, effects: 'unknown', retryable: false });
      if (error instanceof AieError) throw error;
      throw networkError(error, changing);
    }
  }

  async response(call: Promise<ApiResponse<unknown>>): Promise<Response> {
    try {
      return (await call).raw;
    } catch (error) {
      if (error instanceof FetchError) throw networkError(error, false);
      throw error;
    }
  }

  async empty(call: Promise<ApiResponse<unknown>>): Promise<void> {
    try {
      const response = (await call).raw;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (error instanceof FetchError) throw networkError(error, true);
      throw error;
    }
  }
}
