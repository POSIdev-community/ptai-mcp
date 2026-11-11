import { createHash, randomBytes, randomUUID } from 'node:crypto';
import http, { type ServerResponse } from 'node:http';
import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { safeError, ToolError } from '../../shared/errors.js';
import { HttpHeader, HttpMethod, MediaType } from '../../shared/http-constants.js';
import { LIMITS } from '../../shared/limits.js';
import { AieToolName } from '../tool-names.js';
import { browserOpen } from './browser.js';
import { getLoginAsset, loginPageHeaders, renderLoginPage } from './login-pages.js';
import { LoginPage, LoginState } from './models.js';

export type LoginCompletion = (code: string, signal: AbortSignal) => Promise<void>;
/** One listener and one exchange gate per attempt. Authorization codes never leave this class. */
export class LoginAttempt {

  public readonly login_id = randomUUID();
  public readonly created_at = Date.now();

  private readonly stateToken = randomBytes(32).toString('hex');
  private readonly secretPath = `/${randomBytes(32).toString('hex')}`;
  private readonly controller = new AbortController();
  private readonly server = http.createServer((req, res) => {
    void this.handle(req, res).catch(() => this.send(res, 400, { error: 'Request rejected.' }));
  });
  private state: LoginState = LoginState.Waiting;
  private lastError?: ReturnType<typeof safeError>;
  private base = '';
  private browserOpened = false;
  private manualViewed = false;
  private successOpened = false;
  private gate?: Promise<void>;
  private queued?: string;
  private exchangingHash?: string;
  private readonly consumed = new Set<string>();
  private readonly expiry: NodeJS.Timeout;
  private closeTimer?: NodeJS.Timeout;

  public constructor(
    public readonly origin: string,
    private readonly complete: LoginCompletion,
    private readonly open = browserOpen,
  ) {
    this.expiry = setTimeout(() => {
      this.finish(LoginState.Expired);
    }, LIMITS.loginTtlMs);
    this.expiry.unref();
  }

  public async start() {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        this.server.off('error', reject);
        resolve();
      });
    });
    const address = this.server.address();

    if (!address || typeof address === 'string') {
      throw new ToolError(ErrorCode.LoginListenerError, 'Could not reserve a loopback port.');
    }

    this.base = `http://127.0.0.1:${address.port}`;
    this.browserOpened = await this.open(this.loginUrl()).catch(() => false);

    return this.view();
  }

  public pending() {
    return this.state === LoginState.Waiting || this.state === LoginState.Exchanging;
  }

  public cancel() {
    if (this.pending()) {
      this.finish(LoginState.Cancelled);
    }

    return this.view();
  }

  public view() {
    return {
      login_id: this.login_id,
      state: this.state,
      server_url: this.origin,
      login_url: this.loginUrl(),
      manual_url: `${this.base}${this.secretPath}/manual`,
      browser_opened: this.browserOpened,
      expires_at: new Date(this.created_at + LIMITS.loginTtlMs).toISOString(),
      poll_after_ms: this.pending() ? LIMITS.pollMs : null,
      error: this.lastError,
      next_action: this.pending()
        ? 'Complete sign-in in the browser. Enter any manual code only in the local form, never in chat.'
        : undefined,
    };
  }

  public close() {
    clearTimeout(this.expiry);

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }

    this.controller.abort();
    this.server.close();
    this.server.closeAllConnections();
    this.queued = undefined;
  }

  private loginUrl() {
    const url = new URL('/api/auth/integration/signin', this.origin);
    url.search = new URLSearchParams({
      scope: 'Plugin',
      // AIE UI accepts loopback HTTP callbacks for visualstudio, but requires
      // a vscode:// callback when type=vscode.
      type: 'visualstudio',
      state: this.stateToken,
      callbackUrl: `${this.base}${this.secretPath}/callback?code={code}&state={state}`,
    }).toString();

    return url.href;
  }

  private successUrl() {
    return `${this.base}${this.secretPath}/success`;
  }

  private finish(state: LoginState) {
    this.state = state;
    this.queued = undefined;
    clearTimeout(this.expiry);

    if (state !== LoginState.Connected) {
      this.controller.abort();
    }

    this.closeTimer = setTimeout(() => this.close(), LIMITS.terminalLoginMs);
    this.closeTimer.unref();
  }

  private async exchange(code: string) {
    if (!this.pending()) {
      return;
    }

    if (!code || code.length > 8192) {
      throw new ToolError(ErrorCode.ValidationError, 'Invalid authorization code.');
    }

    const hash = createHash('sha256').update(code).digest('hex');

    if (this.consumed.has(hash) || hash === this.exchangingHash) {
      return this.gate;
    }

    if (this.gate) {
      if (!this.queued) {
        this.queued = code;
      }

      return this.gate;
    }

    this.exchangingHash = hash;
    this.state = LoginState.Exchanging;
    this.gate = this.complete(code, this.controller.signal)
      .then(
        () => {
          this.consumed.add(hash);

          if (this.pending()) {
            this.finish(LoginState.Connected);
          }
        },
        (error) => this.exchangeFailed(error, hash),
      )
      .finally(() => this.finishExchange());

    return this.gate;
  }

  private send(res: ServerResponse, status: number, body: Record<string, unknown>) {
    if (res.headersSent || res.destroyed) {
      return;
    }

    res.writeHead(status, {
      [HttpHeader.ContentType]: 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(body));
  }

  private async handleCallback(req: http.IncomingMessage, res: ServerResponse, url: URL) {
    const origin = req.headers.origin;

    if (
      (origin && origin !== this.origin && origin !== this.base) ||
      url.searchParams.get('state') !== this.stateToken
    ) {
      return this.send(res, 403, { error: 'Invalid callback state or origin.' });
    }

    const wasPending = this.pending();
    await this.exchange(url.searchParams.get('code') ?? '');
    this.send(res, 200, { state: this.state });

    // AIE delivers the callback with fetch, so its tab does not navigate.
    // Open a local confirmation tab only when the browser path completed login.
    if (wasPending && this.state === LoginState.Connected && !this.manualViewed && !this.successOpened) {
      this.successOpened = true;
      void this.open(this.successUrl()).catch(() => false);
    }

    return;
  }

  private async handleManualSubmission(req: http.IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin;

    if (
      origin !== this.base ||
      req.headers['x-ptai-login'] !== this.stateToken ||
      !req.headers['content-type']?.startsWith(MediaType.Json)
    ) {
      return this.send(res, 403, { error: 'Invalid form origin or token.' });
    }

    let body = '';

    for await (const chunk of req) {
      body += String(chunk);

      if (Buffer.byteLength(body) > 16_384) {
        return this.send(res, 413, { error: 'Input too large.' });
      }
    }

    const value = JSON.parse(body) as { code?: unknown };

    if (typeof value.code !== 'string') {
      return this.send(res, 400, { error: 'Code required.' });
    }

    this.manualViewed = true;
    await this.exchange(value.code);

    return this.send(res, 200, { state: this.state });
  }

  private async handle(req: http.IncomingMessage, res: ServerResponse) {
    if (req.headers.host !== this.base.slice('http://'.length)) {
      return this.send(res, 403, { error: 'Invalid host.' });
    }

    const url = new URL(req.url ?? '/', this.base);

    if (this.serveAsset(req, res, url.pathname)) {
      return;
    }

    const callback = url.pathname === `${this.secretPath}/callback`;
    const origin = req.headers.origin;

    if (callback && origin === this.origin) {
      res.setHeader('Access-Control-Allow-Origin', this.origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');

      if (req.method === 'OPTIONS') {
        return this.send(res, 200, { accepted: true });
      }
    }

    if (callback && req.method === HttpMethod.Get) {
      return this.handleCallback(req, res, url);
    }

    if (url.pathname === `${this.secretPath}/status` && req.method === HttpMethod.Get) {
      return this.send(res, 200, { state: this.state, error: this.lastError?.message });
    }

    if (url.pathname === `${this.secretPath}/manual` && req.method === HttpMethod.Get) {
      this.manualViewed = true;
      res.writeHead(200, loginPageHeaders);
      res.end(renderLoginPage(LoginPage.Manual, this.origin, this.stateToken));

      return;
    }

    if (url.pathname === `${this.secretPath}/success` && req.method === HttpMethod.Get) {
      if (this.state !== LoginState.Connected) {
        return this.send(res, 409, { error: 'Sign-in is not complete.' });
      }

      res.writeHead(200, loginPageHeaders);
      res.end(renderLoginPage(LoginPage.Success, this.origin));

      return;
    }

    if (url.pathname === `${this.secretPath}/submit` && req.method === HttpMethod.Post) {
      return this.handleManualSubmission(req, res);
    }

    this.send(res, 404, { error: 'Not found.' });
  }

  private exchangeFailed(error: unknown, hash: string) {
    this.lastError = safeError(error, AieToolName.Auth);

    if (!this.pending()) {
      return;
    }

    // Only a confirmed invalid code can be followed by the alternate input.
    if (
      error instanceof ToolError &&
      (error.code === ErrorCode.ValidationError || error.code === ErrorCode.LoginRequired) &&
      error.details.effects !== Effects.Unknown
    ) {
      this.consumed.add(hash);
      this.state = LoginState.Waiting;
    } else {
      this.finish(LoginState.Failed);
    }
  }

  private finishExchange() {
    this.gate = undefined;
    this.exchangingHash = undefined;
    const queued = this.queued;
    this.queued = undefined;

    if (queued && this.pending()) {
      void this.exchange(queued);
    }
  }

  private serveAsset(req: http.IncomingMessage, res: ServerResponse, pathname: string): boolean {
    const assetName = pathname.startsWith(`${this.secretPath}/`) ? pathname.slice(this.secretPath.length + 1) : '';

    const asset = getLoginAsset(assetName);

    if (asset && req.method === HttpMethod.Get) {
      res.writeHead(200, {
        [HttpHeader.ContentType]: asset.contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(asset.body);

      return true;
    }

    return false;
  }
}
