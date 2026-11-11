import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AieApi, serverUrl } from './api.js';
import { AieError, safeError, validation } from './errors.js';
import { LoginAttempt } from './login.js';
import { SessionStorage } from './session-storage.js';
import { sessionFingerprint, type SharedSession } from './session-codec.js';
import { supportedVersion } from './version.js';
import { getBundleDir } from '../utils/paths.js';

export interface ConnectedSession {
  api: AieApi;
  identity: string;
  version: string;
  server_url: string;
  user: { id: string; name?: string | null; login?: string | null };
  permissions: unknown[];
  permissions_complete: boolean;
  permissions_error?: string;
}

interface AuthArguments {
  action: 'login' | 'logout' | 'cancel_login';
  server_url?: string;
  force_login?: boolean;
  login_id?: string;
}

export class Sessions {
  onAction: (action: string, outcome: string, version?: string) => void = () => undefined;
  get currentVersion() {
    return this.cached?.value.version;
  }
  private cached?: { fingerprint: string; value: ConnectedSession; checked: number };
  private attempt?: LoginAttempt;
  private refreshTask?: Promise<SharedSession>;
  private watcher?: fs.FSWatcher;
  private watchTimer?: NodeJS.Timeout;
  private lastIdentity?: string;
  private closed = false;
  private watchWarning?: string;

  constructor(
    readonly storage = new SessionStorage(path.join(getBundleDir(), 'shared_variables')),
    private readonly apiFactory = (origin: string, token?: string) => new AieApi(origin, token),
    private readonly onIdentityChange: (oldIdentity: string) => void = () => undefined,
    private readonly loginFactory = (origin: string, complete: (code: string, signal: AbortSignal) => Promise<void>) =>
      new LoginAttempt(origin, complete),
  ) {}

  async initialize() {
    try {
      await fsp.mkdir(path.dirname(this.storage.file), { recursive: true });
      this.watcher = fs.watch(path.dirname(this.storage.file), (_event, file) => {
        if (file && file.toString() !== path.basename(this.storage.file)) return;
        if (this.watchTimer) clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => {
          void this.observe().catch(() => undefined);
        }, 75);
        this.watchTimer.unref();
      });
      this.watcher.unref();
    } catch {
      // Catalog and context must remain available even when an OS-owned bundle
      // directory does not yet exist or is inaccessible. Calls reread storage.
      this.watchWarning =
        'Shared-session watching is unavailable. Check directory access before signing in; requests still reread storage.';
    }
  }

  async require(): Promise<ConnectedSession> {
    if (this.closed) throw new AieError('AIE_SHUTTING_DOWN', 'The MCP server is shutting down.');
    let shared = await this.storage.read();
    if (!shared) {
      this.changed(undefined);
      throw new AieError('AIE_LOGIN_REQUIRED', 'No shared AIE session is available.', {
        next_action: 'Call aie_auth(action=login, server_url=the selected server URL), then repeat the operation.',
        effects: 'not_applied',
      });
    }
    try {
      return await this.connect(shared);
    } catch (error) {
      if (!(error instanceof AieError) || error.code !== 'AIE_LOGIN_REQUIRED') throw error;
      const latest = await this.storage.read();
      if (!latest) {
        this.changed(undefined);
        throw error;
      }
      shared = sessionFingerprint(latest) !== sessionFingerprint(shared) ? latest : await this.refresh(latest);
      return this.connect(shared, true);
    }
  }

  async context(loginId?: string): Promise<Record<string, unknown>> {
    if (loginId && this.attempt?.login_id !== loginId)
      throw new AieError(
        'AIE_LOGIN_NOT_FOUND',
        'Login attempt was lost after restart, expired, or does not exist. Start an explicit login.',
      );
    let connected: ConnectedSession | undefined;
    let error: ReturnType<typeof safeError> | undefined;
    try {
      connected = await this.require();
    } catch (cause) {
      error = safeError(cause, 'aie_get_context');
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

  async auth(args: AuthArguments): Promise<Record<string, unknown>> {
    if (args.action === 'cancel_login') {
      if (!args.login_id) validation('cancel_login requires login_id.');
      if (this.attempt?.login_id !== args.login_id)
        throw new AieError('AIE_LOGIN_NOT_FOUND', 'This process has no such login attempt.');
      return { login: this.attempt.cancel(), previous_session_preserved: true };
    }
    if (args.action === 'logout') {
      this.attempt?.cancel();
      const current = await this.storage.read();
      let remoteError: ReturnType<typeof safeError> | undefined;
      if (current) {
        try {
          const api = this.apiFactory(serverUrl(current.EnterpriseApiUri), current.AccessToken);
          await api.empty(api.auth.apiAuthSignoutGetRaw());
        } catch (error) {
          remoteError = safeError(error, 'aie_auth');
        }
        await this.storage.clear(sessionFingerprint(current));
      }
      this.cached = undefined;
      this.changed(undefined);
      this.onAction('logout', remoteError ? 'partial' : 'applied');
      return {
        connected: false,
        shared_session_cleared: true,
        remote_logout_confirmed: !remoteError,
        remote_error: remoteError,
      };
    }
    if (args.action !== 'login') validation('Unknown auth action.');
    const old = await this.storage.read();
    const origin = args.server_url
      ? serverUrl(args.server_url)
      : old
        ? serverUrl(old.EnterpriseApiUri)
        : this.attempt?.origin;
    if (!origin)
      throw new AieError('AIE_SERVER_REQUIRED', 'Select an AIE server URL to begin sign-in.', {
        next_action: 'Ask the user for the AIE server URL and call aie_auth(action=login, server_url=...).',
        effects: 'not_applied',
      });
    if (!args.force_login && old && serverUrl(old.EnterpriseApiUri) === origin) {
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
        if (!(error instanceof AieError) || error.code !== 'AIE_LOGIN_REQUIRED') throw error;
      }
    }
    if (!args.force_login && this.attempt?.origin === origin && this.attempt.pending())
      return { connected: false, login: this.attempt.view(), reused_attempt: true };
    this.attempt?.cancel();
    this.attempt?.close();
    const previous = sessionFingerprint(await this.storage.read());
    const attempt = this.loginFactory(origin, async (code, signal) => {
      const api = this.apiFactory(origin);
      const tokens = await api.json(
        api.external.apiAuthExternalSigninCompleteGetRaw({ code, scopeType: 'Plugin' }, { signal }),
      );
      if (!tokens.accessToken || !tokens.refreshToken)
        throw new AieError('AIE_INVALID_RESPONSE', 'Sign-in did not return both required tokens.');
      const shared: SharedSession = {
        AccessToken: tokens.accessToken,
        RefreshToken: tokens.refreshToken,
        EnterpriseApiUri: origin,
      };
      const connected = await this.inspect(shared, signal);
      const beforeCommit = () => {
        if (signal.aborted || this.closed || this.attempt !== attempt || !attempt.pending())
          throw new AieError('AIE_CANCELLED', 'Login attempt is no longer active.');
      };
      beforeCommit();
      // Lock acquisition/verification can await another process. Recheck the
      // attempt inside that transaction, immediately before publication.
      await this.storage.write(shared, previous, beforeCommit);
      this.cached = { fingerprint: sessionFingerprint(shared), value: connected, checked: Date.now() };
      this.changed(connected.identity);
      this.onAction('login', 'applied', connected.version);
    });
    this.attempt = attempt;
    try {
      return { connected: false, login: await attempt.start() };
    } catch {
      attempt.close();
      throw new AieError(
        'AIE_LOGIN_LISTENER_ERROR',
        'Could not start the local sign-in listener. Existing session preserved.',
      );
    }
  }

  async assertIdentity(identity: string) {
    const current = await this.require();
    if (identity !== current.identity)
      throw new AieError('AIE_CONTEXT_CHANGED', 'Server or user changed. No further workflow steps will be performed.');
    return current;
  }

  close() {
    this.closed = true;
    this.watcher?.close();
    if (this.watchTimer) clearTimeout(this.watchTimer);
    this.attempt?.close();
    // Process shutdown is deliberately not an AIE logout.
  }

  private async connect(shared: SharedSession, force = false) {
    const fingerprint = sessionFingerprint(shared);
    if (!force && this.cached?.fingerprint === fingerprint && Date.now() - this.cached.checked < 60_000)
      return this.cached.value;
    const value = await this.inspect(shared);
    if (sessionFingerprint(await this.storage.read()) !== fingerprint)
      throw new AieError('AIE_CONTEXT_CHANGED', 'Shared session changed during validation. Repeat the read.');
    const pickup = this.lastIdentity !== value.identity;
    this.cached = { fingerprint, value, checked: Date.now() };
    this.changed(value.identity);
    if (pickup) this.onAction('session_pickup', 'applied', value.version);
    return value;
  }

  private async inspect(shared: SharedSession, signal?: AbortSignal): Promise<ConnectedSession> {
    const origin = serverUrl(shared.EnterpriseApiUri);
    const api = this.apiFactory(origin, shared.AccessToken);
    const version = supportedVersion(await api.json(api.version.apiVersionsPackageCurrentGetRaw({ signal })));
    const user = await api.json(api.user.apiAuthUsersCurrentGetRaw({ signal }));
    if (!user?.id) throw new AieError('AIE_INVALID_RESPONSE', 'AIE did not return the authenticated user ID.');
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
    if (this.refreshTask) return this.refreshTask;
    this.refreshTask = (async () => {
      return this.storage.refresh(sessionFingerprint(original), async (current) => {
        const api = this.apiFactory(serverUrl(current.EnterpriseApiUri), current.RefreshToken);
        const tokens = await api.json(api.auth.apiAuthRefreshTokenGetRaw());
        if (!tokens.accessToken) throw new AieError('AIE_INVALID_RESPONSE', 'Refresh did not return an access token.');
        return { ...current, AccessToken: tokens.accessToken };
      });
    })().finally(() => {
      this.refreshTask = undefined;
    });
    return this.refreshTask;
  }

  private changed(identity: string | undefined) {
    if (this.lastIdentity && this.lastIdentity !== identity) this.onIdentityChange(this.lastIdentity);
    this.lastIdentity = identity;
  }
  private async tokenFor(identity: string): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const connected = await this.require();
      if (connected.identity !== identity)
        throw new AieError('AIE_CONTEXT_CHANGED', 'The server or user changed before the next request.', {
          effects: 'not_applied',
        });
      const shared = await this.storage.read();
      if (!shared)
        throw new AieError('AIE_LOGIN_REQUIRED', 'Shared session was removed before the request.', {
          effects: 'not_applied',
        });
      if (this.cached?.fingerprint === sessionFingerprint(shared)) return shared.AccessToken;
      this.cached = undefined;
    }
    throw new AieError('AIE_CONTEXT_CHANGED', 'The shared session is changing. Retry after it settles.', {
      effects: 'not_applied',
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
}
