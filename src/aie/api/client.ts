import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import { HttpHeader, HttpMethod, MediaType } from '../../shared/http-constants.js';
import { RedirectPolicy } from '../../shared/io-constants.js';
import { LIMITS } from '../../shared/limits.js';
import { AgentsApi } from '../../vendor/aie-v63/src/apis/AgentsApi.js';
import { AuthApi } from '../../vendor/aie-v63/src/apis/AuthApi.js';
import { BranchesApi } from '../../vendor/aie-v63/src/apis/BranchesApi.js';
import { ChangeHistoryApi } from '../../vendor/aie-v63/src/apis/ChangeHistoryApi.js';
import { ConfigsApi } from '../../vendor/aie-v63/src/apis/ConfigsApi.js';
import { DirectoryContentApi } from '../../vendor/aie-v63/src/apis/DirectoryContentApi.js';
import { ExternalAuthApi } from '../../vendor/aie-v63/src/apis/ExternalAuthApi.js';
import { FileContentApi } from '../../vendor/aie-v63/src/apis/FileContentApi.js';
import { InitiatorApi } from '../../vendor/aie-v63/src/apis/InitiatorApi.js';
import { PMGroupsApi } from '../../vendor/aie-v63/src/apis/PMGroupsApi.js';
import { PmRuleVulnTypesApi } from '../../vendor/aie-v63/src/apis/PmRuleVulnTypesApi.js';
import { ProjectsApi } from '../../vendor/aie-v63/src/apis/ProjectsApi.js';
import { ScanQueueApi } from '../../vendor/aie-v63/src/apis/ScanQueueApi.js';
import { StoreApi } from '../../vendor/aie-v63/src/apis/StoreApi.js';
import { UserApi } from '../../vendor/aie-v63/src/apis/UserApi.js';
import { VersionApi } from '../../vendor/aie-v63/src/apis/VersionApi.js';
import { type ApiResponse, Configuration, FetchError } from '../../vendor/aie-v63/src/runtime.js';
import { boundedBody } from './body.js';
import { httpError, networkError } from './http-errors.js';
import { aieRequest } from './transport.js';

/** All domain requests use the generated AI.Api.Client 6.3 client, never a tool-supplied URL. */
export class AieApi {

  public readonly origin: string;

  public beforeRequest?: () => Promise<string>;
  public recoverUnauthorized?: () => Promise<string>;
  public readonly auth: AuthApi;
  public readonly external: ExternalAuthApi;
  public readonly initiator: InitiatorApi;
  public readonly user: UserApi;
  public readonly version: VersionApi;
  public readonly projects: ProjectsApi;
  public readonly branches: BranchesApi;
  public readonly store: StoreApi;
  public readonly configs: ConfigsApi;
  public readonly groups: PMGroupsApi;
  public readonly types: PmRuleVulnTypesApi;
  public readonly agents: AgentsApi;
  public readonly queue: ScanQueueApi;
  public readonly history: ChangeHistoryApi;
  public readonly files: FileContentApi;
  public readonly directories: DirectoryContentApi;

  private readonly request: typeof fetch;
  private readonly changingResponses = new WeakSet<Response>();

  public constructor(
    origin: string,
    private readonly token?: string,
    request?: typeof fetch,
    private readonly signal?: AbortSignal,
  ) {
    this.origin = origin;
    this.request = request ?? aieRequest(origin);
    const config = new Configuration({
      basePath: origin,
      apiKey: () => (token ? this.authorization(token) : ''),
      fetchApi: (url, init) => this.fetch(url, init),
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
    this.files = new FileContentApi(config);
    this.directories = new DirectoryContentApi(config);
  }

  public scoped(signal: AbortSignal): AieApi {
    const scoped = new AieApi(this.origin, this.token, this.request, signal);
    scoped.beforeRequest = this.beforeRequest;
    scoped.recoverUnauthorized = this.recoverUnauthorized;

    return scoped;
  }

  public async json<T>(call: Promise<ApiResponse<T>>): Promise<T> {
    let response: Response | undefined;

    try {
      response = (await call).raw;
      const body = await boundedBody(response);

      if (!body.length) {
        throw new ToolError(
          ErrorCode.InvalidResponse,
          'AIE returned an empty body where a response value was required.',
        );
      }

      const text = body.toString('utf8');

      try {
        return JSON.parse(text) as T;
      } catch {
        // Several scalar 6.3 endpoints use text/plain (the generated Raw
        // methods normally select TextApiResponse for these).
        if (response.headers.get(HttpHeader.ContentType)?.toLowerCase().startsWith(MediaType.Text)) {
          return text as T;
        }

        throw new ToolError(ErrorCode.InvalidResponse, 'AIE returned invalid JSON.');
      }
    } catch (error) {
      const changing = !!response && this.changingResponses.has(response);

      if (error instanceof ToolError && changing) {
        throw new ToolError(error.code, error.message, {
          ...error.details,
          effects: Effects.Unknown,
          retryable: false,
        });
      }

      if (error instanceof ToolError) {
        throw error;
      }

      throw networkError(error, changing);
    }
  }

  public async response(call: Promise<ApiResponse<unknown>>): Promise<Response> {
    try {
      return (await call).raw;
    } catch (error) {
      if (error instanceof FetchError) {
        throw networkError(error, false);
      }

      throw error;
    }
  }

  public async empty(call: Promise<ApiResponse<unknown>>): Promise<void> {
    try {
      const response = (await call).raw;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (error instanceof FetchError) {
        throw networkError(error, true);
      }

      throw error;
    }
  }

  private async fetch(url: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
    // Code exchange and signout are GET in the upstream contract but have effects.
    const changing = init?.method !== HttpMethod.Get || /signin\/complete|signout|refreshToken/.test(String(url));

    try {
      const prepared = await this.prepareRequest(init);
      prepared.signal?.throwIfAborted();
      const initialResponse = await this.request(url, prepared);
      const response = await this.recoverResponse(initialResponse, url, prepared, changing);

      if (!response.ok) {
        throw await httpError(response, changing);
      }

      if (changing) {
        this.changingResponses.add(response);
      }

      return response;
    } catch (error) {
      throw networkError(error, changing);
    }
  }

  private async prepareRequest(init: RequestInit | undefined): Promise<RequestInit> {
    const prepared: RequestInit = {
      ...init,
      redirect: RedirectPolicy.Reject,
      signal: init?.signal ?? this.signal ?? AbortSignal.timeout(LIMITS.requestMs),
    };

    if (this.beforeRequest) {
      return this.withAuthorization(prepared, await this.beforeRequest());
    }

    return prepared;
  }

  private async recoverResponse(
    response: Response,
    url: Parameters<typeof fetch>[0],
    prepared: RequestInit,
    changing: boolean,
  ): Promise<Response> {
    if (response.status !== 401 || !this.recoverUnauthorized) {
      return response;
    }

    const latest = await this.recoverUnauthorized();

    // Recover the shared session for the next call, but never replay a mutation.
    if (changing) {
      return response;
    }

    await response.body?.cancel();

    return this.request(url, this.withAuthorization(prepared, latest));
  }

  private withAuthorization(prepared: RequestInit, token: string): RequestInit {
    const headers = new Headers(prepared.headers);
    headers.set(HttpHeader.Authorization, this.authorization(token));

    return { ...prepared, headers };
  }

  private authorization(token: string): string {
    return `Bearer ${token}`;
  }
}
