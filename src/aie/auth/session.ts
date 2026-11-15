import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { safeError, ToolError, validation } from '../../shared/errors.js';
import { getBundleDir } from '../../utils/paths.js';
import { AieApi } from '../api/client.js';
import { AuthScope } from '../api/contracts.js';
import { serverUrl } from '../api/server-url.js';
import { supportedVersion } from '../api/version.js';
import { AieToolName } from '../tool-names.js';
import { LoginAttempt } from './login-attempt.js';
import { AuthAction, type AuthArguments, type ConnectedSession, SessionAction, type SharedSession } from './models.js';
import { sessionFingerprint } from './session-codec.js';
import { SessionStorage } from './session-storage.js';

export class Sessions {

  public onAction: (action: string, outcome: string, version?: string) => void;

  private cached?: { fingerprint: string; value: ConnectedSession; checked: number };
  private attempt?: LoginAttempt;
  private refreshTask?: Promise<SharedSession>;
  private watcher?: fs.FSWatcher;
  private watchTimer?: NodeJS.Timeout;
  private lastIdentity?: string;
  private closed = false;
  private watchWarning?: string;

  public constructor(
    public readonly storage = new SessionStorage(path.join(getBundleDir(), 'shared_variables')),
    private readonly apiFactory = (origin: string, token?: string) => new AieApi(origin, token),
    private readonly onIdentityChange: (oldIdentity: string) => void = () => undefined,
    private readonly loginFactory = (origin: string, complete: (code: string, signal: AbortSignal) => Promise<void>) =>
      new LoginAttempt(origin, complete),
  ) {
    this.onAction = () => undefined;
  }

  public get currentVersion() {
    return this.cached?.value.version;
  }

  public async initialize() {
    try {
      await fsp.mkdir(path.dirname(this.storage.file), { recursive: true });
      this.watcher = fs.watch(path.dirname(this.storage.file), (_event, file) => {
        if (file && file.toString() !== path.basename(this.storage.file)) {
          return;
        }

        this.scheduleObservation();
      });
      this.watcher.unref();
    } catch {
      // Catalog and context must remain available even when an OS-owned bundle
      // directory does not yet exist or is inaccessible. Calls reread storage.
      this.watchWarning =
        'Shared-session watching is unavailable. Check directory access before signing in; requests still reread storage.';
    }
  }

  public async require(): Promise<ConnectedSession> {
    if (this.closed) {
      throw new ToolError(ErrorCode.ShuttingDown, 'The MCP server is shutting down.');
    }

    let shared = await this.storage.read();

    if (!shared) {
      this.changed(undefined);
      throw new ToolError(ErrorCode.LoginRequired, 'No shared AIE session is available.', {
        next_action: 'Call aie_auth(action=login, server_url=the selected server URL), then repeat the operation.',
        effects: Effects.NotApplied,
      });
    }

    try {
      return await this.connect(shared);
    } catch (error) {
      if (!(error instanceof ToolError) || error.code !== ErrorCode.LoginRequired) {
        throw error;
      }

      const latest = await this.storage.read();

      if (!latest) {
        this.changed(undefined);
        throw error;
      }

      shared = sessionFingerprint(latest) !== sessionFingerprint(shared) ? latest : await this.refresh(latest);

      return this.connect(shared, true);
    }
  }

  public async local(): Promise<ConnectedSession> {
    const shared = await this.storage.read();

    if (!this.closed && this.cached && shared && this.cached.fingerprint === sessionFingerprint(shared)) {
      return this.cached.value;
    }

    return this.require();
  }

  public async context(loginId?: string): Promise<Record<string, unknown>> {
    if (loginId && this.attempt?.login_id !== loginId) {
      throw new ToolError(
        ErrorCode.LoginNotFound,
        'Login attempt was lost after restart, expired, or does not exist. Start an explicit login.',
      );
    }

    let connected: ConnectedSession | undefined;
    let error: ReturnType<typeof safeError> | undefined;

    try {
      connected = await this.require();
    } catch (cause) {
      error = safeError(cause, AieToolName.GetContext);
    }

    const known = connected?.server_url ?? (await this.storage.read().catch(() => null))?.EnterpriseApiUri;

    return {
      connected: !!connected,
      server_url: known,
      user: connected?.user,
      version: connected?.version,
      permissions: connected?.permissions,
      permissions_complete: connected?.permissions_complete,
      permissions_error: connected?.permissions_error,
      permissions_advisory: true,
      storage_warning: this.watchWarning,
      login: this.attempt?.view(),
      error,
    };
  }

  public async auth(args: AuthArguments): Promise<Record<string, unknown>> {
    switch (args.action) {
      case AuthAction.CancelLogin:
        return this.cancelLogin(args.login_id);
      case AuthAction.Logout:
        return this.logout();
      case AuthAction.Login:
        return this.login(args);
      default:
        return validation('Unknown auth action.');
    }
  }

  public async assertIdentity(identity: string) {
    const current = await this.require();

    if (identity !== current.identity) {
      throw new ToolError(
        ErrorCode.ContextChanged,
        'Server or user changed. No further workflow steps will be performed.',
      );
    }

    return current;
  }

  public close() {
    this.closed = true;
    this.watcher?.close();

    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
    }

    this.attempt?.close();
    // Process shutdown is deliberately not an AIE logout.
  }

  private scheduleObservation() {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
    }

    this.watchTimer = setTimeout(() => {
      void this.observe().catch(() => undefined);
    }, 75);
    this.watchTimer.unref();
  }

  private cancelLogin(loginId?: string) {
    if (!loginId) {
      validation('cancel_login requires login_id.');
    }

    if (this.attempt?.login_id !== loginId) {
      throw new ToolError(ErrorCode.LoginNotFound, 'This process has no such login attempt.');
    }

    return { login: this.attempt.cancel(), previous_session_preserved: true };
  }

  private async logout() {
    this.attempt?.cancel();
    const current = await this.storage.read();
    let remoteError: ReturnType<typeof safeError> | undefined;

    if (current) {
      try {
        const api = this.apiFactory(serverUrl(current.EnterpriseApiUri), current.AccessToken);
        await api.empty(api.auth.apiAuthSignoutGetRaw());
      } catch (error) {
        remoteError = safeError(error, AieToolName.Auth);
      }

      await this.storage.clear(sessionFingerprint(current));
    }

    this.cached = undefined;
    this.changed(undefined);
    this.onAction(AuthAction.Logout, remoteError ? Effects.Partial : Effects.Applied);

    return {
      connected: false,
      shared_session_cleared: true,
      remote_logout_confirmed: !remoteError,
      remote_error: remoteError,
    };
  }

  private loginOrigin(args: AuthArguments, previous: SharedSession | null): string | undefined {
    if (args.server_url) {
      return serverUrl(args.server_url);
    }

    if (previous) {
      return serverUrl(previous.EnterpriseApiUri);
    }

    return this.attempt?.origin;
  }

  private async login(args: AuthArguments) {
    const old = await this.storage.read();
    const origin = this.loginOrigin(args, old);

    if (!origin) {
      throw new ToolError(ErrorCode.ServerRequired, 'Select an AIE server URL to begin sign-in.', {
        next_action: 'Ask the user for the AIE server URL and call aie_auth(action=login, server_url=...).',
        effects: Effects.NotApplied,
      });
    }

    if (!args.force_login && old && serverUrl(old.EnterpriseApiUri) === origin) {
      const reused = await this.reuseSession();

      if (reused) {
        return reused;
      }
    }

    if (!args.force_login && this.attempt?.origin === origin && this.attempt.pending()) {
      return { connected: false, login: this.attempt.view(), reused_attempt: true };
    }

    this.attempt?.cancel();
    this.attempt?.close();
    const previous = sessionFingerprint(await this.storage.read());
    const attempt = this.loginFactory(origin, async (code, signal) =>
      this.completeLogin(origin, code, signal, previous, attempt),
    );

    this.attempt = attempt;

    try {
      return { connected: false, login: await attempt.start() };
    } catch {
      attempt.close();
      throw new ToolError(
        ErrorCode.LoginListenerError,
        'Could not start the local sign-in listener. Existing session preserved.',
      );
    }
  }

  private async connect(shared: SharedSession, force = false) {
    const fingerprint = sessionFingerprint(shared);

    if (!force && this.cached?.fingerprint === fingerprint && Date.now() - this.cached.checked < 60_000) {
      return this.cached.value;
    }

    const value = await this.inspect(shared);

    if (sessionFingerprint(await this.storage.read()) !== fingerprint) {
      throw new ToolError(ErrorCode.ContextChanged, 'Shared session changed during validation. Repeat the read.');
    }

    const pickup = this.lastIdentity !== value.identity;
    this.cached = { fingerprint, value, checked: Date.now() };
    this.changed(value.identity);

    if (pickup) {
      this.onAction(SessionAction.Pickup, Effects.Applied, value.version);
    }

    return value;
  }

  private async inspect(shared: SharedSession, signal?: AbortSignal): Promise<ConnectedSession> {
    const origin = serverUrl(shared.EnterpriseApiUri);
    const api = this.apiFactory(origin, shared.AccessToken);
    const version = supportedVersion(await api.json(api.version.apiVersionsPackageCurrentGetRaw({ signal })));
    api.serverVersion = version;
    const user = await api.json(api.user.apiAuthUsersCurrentGetRaw({ signal }));

    if (!user?.id) {
      throw new ToolError(ErrorCode.InvalidResponse, 'AIE did not return the authenticated user ID.');
    }

    let permissions: unknown[] = [];
    let permissionsError: string | undefined;

    try {
      permissions = await api.json(api.user.apiAuthUsersUserIdPermissionsGetRaw({ userId: user.id }, { signal }));
    } catch (error) {
      permissionsError = safeError(error, 'read_permissions').code;
    }

    const identity = createHash('sha256')
      .update(JSON.stringify([origin, user.id]))
      .digest('hex');

    api.beforeRequest = () => this.tokenFor(identity);

    api.recoverUnauthorized = async () => {
      this.cached = undefined;

      return this.tokenFor(identity);
    };

    return {
      api,
      identity,
      version,
      server_url: origin,
      user: { id: user.id, name: user.name, login: user.login },
      permissions,
      permissions_complete: !permissionsError,
      permissions_error: permissionsError,
    };
  }

  private async refresh(original: SharedSession): Promise<SharedSession> {
    if (this.refreshTask) {
      return this.refreshTask;
    }

    this.refreshTask = (async () => {
      return this.storage.refresh(sessionFingerprint(original), async (current) => {
        const api = this.apiFactory(serverUrl(current.EnterpriseApiUri), current.RefreshToken);
        const tokens = await api.json(api.auth.apiAuthRefreshTokenGetRaw());

        if (!tokens.accessToken) {
          throw new ToolError(ErrorCode.InvalidResponse, 'Refresh did not return an access token.');
        }

        return { ...current, AccessToken: tokens.accessToken };
      });
    })().finally(() => {
      this.refreshTask = undefined;
    });

    return this.refreshTask;
  }

  private changed(identity: string | undefined) {
    if (this.lastIdentity && this.lastIdentity !== identity) {
      this.onIdentityChange(this.lastIdentity);
    }

    this.lastIdentity = identity;
  }

  private async tokenFor(identity: string): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const connected = await this.require();

      if (connected.identity !== identity) {
        throw new ToolError(ErrorCode.ContextChanged, 'The server or user changed before the next request.', {
          effects: Effects.NotApplied,
        });
      }

      const shared = await this.storage.read();

      if (!shared) {
        throw new ToolError(ErrorCode.LoginRequired, 'Shared session was removed before the request.', {
          effects: Effects.NotApplied,
        });
      }

      if (this.cached?.fingerprint === sessionFingerprint(shared)) {
        return shared.AccessToken;
      }

      this.cached = undefined;
    }

    throw new ToolError(ErrorCode.ContextChanged, 'The shared session is changing. Retry after it settles.', {
      effects: Effects.NotApplied,
    });
  }

  private async observe() {
    const current = await this.storage.read();

    if (!current) {
      this.cached = undefined;
      this.changed(undefined);
    } else if (sessionFingerprint(current) !== this.cached?.fingerprint) {
      this.cached = undefined;
      await this.connect(current);
    }
  }

  private async completeLogin(
    origin: string,
    code: string,
    signal: AbortSignal,
    previous: string,
    attempt: LoginAttempt,
  ) {
    const api = this.apiFactory(origin);
    const tokens = await api.json(
      api.external.apiAuthExternalSigninCompleteGetRaw({ code, scopeType: AuthScope.Plugin }, { signal }),
    );

    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new ToolError(ErrorCode.InvalidResponse, 'Sign-in did not return both required tokens.');
    }

    const shared: SharedSession = {
      AccessToken: tokens.accessToken,
      RefreshToken: tokens.refreshToken,
      EnterpriseApiUri: origin,
    };

    const connected = await this.inspect(shared, signal);

    const beforeCommit = () => {
      if (signal.aborted || this.closed || this.attempt !== attempt || !attempt.pending()) {
        throw new ToolError(ErrorCode.Cancelled, 'Login attempt is no longer active.');
      }
    };

    beforeCommit();
    // Lock acquisition/verification can await another process. Recheck the
    // attempt inside that transaction, immediately before publication.
    await this.storage.write(shared, previous, beforeCommit);
    this.cached = { fingerprint: sessionFingerprint(shared), value: connected, checked: Date.now() };
    this.changed(connected.identity);
    this.onAction(AuthAction.Login, Effects.Applied, connected.version);
  }

  private async reuseSession() {
    try {
      const current = await this.require();

      return {
        connected: true,
        server_url: current.server_url,
        version: current.version,
        user: current.user,
        reused_session: true,
      };
    } catch (error) {
      if (!(error instanceof ToolError) || error.code !== ErrorCode.LoginRequired) {
        throw error;
      }
    }

    return undefined;
  }
}
