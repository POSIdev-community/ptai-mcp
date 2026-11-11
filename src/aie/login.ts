import http, { type ServerResponse } from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { AieError, safeError } from './errors.js';
import { LIMITS } from './limits.js';

type LoginState = 'waiting' | 'exchanging' | 'connected' | 'cancelled' | 'expired' | 'failed';
export type LoginCompletion = (code: string, signal: AbortSignal) => Promise<void>;
// Corporate AIE web asset: static/ai_casgate_logo.svg in the AIE frontend repository.
const logoSvg = readFileSync(new URL('./ai_casgate_logo.svg', import.meta.url), 'utf8');
const fontAssets = new Map([
  ['Inter-Regular.woff2', readFileSync(new URL('./Inter-Regular.woff2', import.meta.url))],
  ['TT-Positive-Regular.woff2', readFileSync(new URL('./TT-Positive-Regular.woff2', import.meta.url))],
]);

function browserOpen(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true, detached: true });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}

function html(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function pageStyle(nonce: string) {
  // Adapted from external-login-success-page.component.html/.scss in AIE web.
  return `<style nonce="${nonce}">
    *{box-sizing:border-box}
    @font-face{font-family:Inter;src:url('./Inter-Regular.woff2') format('woff2');font-style:normal;font-weight:400;font-display:swap}
    @font-face{font-family:TT-Positive;src:url('./TT-Positive-Regular.woff2') format('woff2');font-style:normal;font-weight:400;font-display:swap}
    body{margin:0;background:#fff;color:#24262b;font:16px/1.5 Inter,Arial,sans-serif}
    .root{width:min(588px,calc(100% - 48px));margin:48px auto}
    .pt-logo{display:flex;align-items:center;margin-bottom:64px}
    .pt-logo svg{display:block;width:273px;height:32px;max-width:100%}
    h1{margin:0;font:400 36px/44px TT-Positive,Inter,Arial,sans-serif}
    .subheader{margin:16px 0 32px}
    .description-block{display:flex;flex-direction:column;gap:12px;padding:24px;background:#f4f5f7}
    .description-block p{margin:0}
    .server{overflow-wrap:anywhere;color:#626b75;font-size:14px}
    label{display:block;margin-bottom:8px;font-weight:600}
    input{display:block;width:100%;padding:10px 12px;border:1px solid #bbc3cc;border-radius:4px;background:#fff;font:inherit}
    button{align-self:flex-start;padding:10px 18px;border:0;border-radius:4px;background:#e0002b;color:#fff;font:inherit;font-weight:600;cursor:pointer}
    button:disabled{opacity:.5;cursor:default}
    .hint{color:#626b75;font-size:14px}
    [hidden]{display:none!important}
    @media(max-width:600px){.root{margin:32px auto}.pt-logo{margin-bottom:48px}h1{font-size:32px;line-height:40px}}
  </style>`;
}

/** One listener and one exchange gate per attempt. Authorization codes never leave this class. */
export class LoginAttempt {
  readonly login_id = randomUUID();
  readonly created_at = Date.now();
  private readonly stateToken = randomBytes(32).toString('hex');
  private readonly secretPath = `/${randomBytes(32).toString('hex')}`;
  private readonly controller = new AbortController();
  private readonly server = http.createServer((req, res) => {
    void this.handle(req, res).catch(() => this.send(res, 400, { error: 'Request rejected.' }));
  });
  private state: LoginState = 'waiting';
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

  constructor(
    readonly origin: string,
    private readonly complete: LoginCompletion,
    private readonly open = browserOpen,
  ) {
    this.expiry = setTimeout(() => {
      this.finish('expired');
    }, LIMITS.loginTtlMs);
    this.expiry.unref();
  }

  async start() {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        this.server.off('error', reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === 'string')
      throw new AieError('AIE_LOGIN_LISTENER_ERROR', 'Could not reserve a loopback port.');
    this.base = `http://127.0.0.1:${address.port}`;
    this.browserOpened = await this.open(this.loginUrl()).catch(() => false);
    return this.view();
  }

  pending() {
    return this.state === 'waiting' || this.state === 'exchanging';
  }
  cancel() {
    if (this.pending()) this.finish('cancelled');
    return this.view();
  }
  view() {
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
  close() {
    clearTimeout(this.expiry);
    if (this.closeTimer) clearTimeout(this.closeTimer);
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
    if (state !== 'connected') this.controller.abort();
    this.closeTimer = setTimeout(() => this.close(), LIMITS.terminalLoginMs);
    this.closeTimer.unref();
  }

  private async exchange(code: string) {
    if (!this.pending()) return;
    if (!code || code.length > 8192) throw new AieError('AIE_VALIDATION_ERROR', 'Invalid authorization code.');
    const hash = createHash('sha256').update(code).digest('hex');
    if (this.consumed.has(hash) || hash === this.exchangingHash) return this.gate;
    if (this.gate) {
      if (!this.queued) this.queued = code;
      return this.gate;
    }
    this.exchangingHash = hash;
    this.state = 'exchanging';
    this.gate = this.complete(code, this.controller.signal)
      .then(
        () => {
          this.consumed.add(hash);
          if (this.pending()) this.finish('connected');
        },
        (error) => {
          this.lastError = safeError(error, 'aie_auth');
          if (!this.pending()) return;
          // Only a confirmed invalid code can be followed by the alternate input.
          if (
            error instanceof AieError &&
            ['AIE_VALIDATION_ERROR', 'AIE_LOGIN_REQUIRED'].includes(error.code) &&
            error.details.effects !== 'unknown'
          ) {
            this.consumed.add(hash);
            this.state = 'waiting';
          } else this.finish('failed');
        },
      )
      .finally(() => {
        this.gate = undefined;
        this.exchangingHash = undefined;
        const queued = this.queued;
        this.queued = undefined;
        if (queued && this.pending()) void this.exchange(queued);
      });
    return this.gate;
  }

  private send(res: ServerResponse, status: number, body: Record<string, unknown>) {
    if (res.headersSent || res.destroyed) return;
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(body));
  }

  private async handle(req: http.IncomingMessage, res: ServerResponse) {
    if (req.headers.host !== this.base.slice('http://'.length)) return this.send(res, 403, { error: 'Invalid host.' });
    const url = new URL(req.url ?? '/', this.base);
    const fontName = url.pathname.startsWith(`${this.secretPath}/`)
      ? url.pathname.slice(this.secretPath.length + 1)
      : '';
    const font = fontAssets.get(fontName);
    if (font && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'font/woff2',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(font);
      return;
    }
    const callback = url.pathname === `${this.secretPath}/callback`;
    const origin = req.headers.origin;
    if (callback && origin === this.origin) {
      res.setHeader('Access-Control-Allow-Origin', this.origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
      if (req.method === 'OPTIONS') return this.send(res, 200, { accepted: true });
    }
    if (callback && req.method === 'GET') {
      if (
        (origin && origin !== this.origin && origin !== this.base) ||
        url.searchParams.get('state') !== this.stateToken
      )
        return this.send(res, 403, { error: 'Invalid callback state or origin.' });
      const wasPending = this.pending();
      await this.exchange(url.searchParams.get('code') ?? '');
      this.send(res, 200, { state: this.state });
      // AIE delivers the callback with fetch, so its tab does not navigate.
      // Open a local confirmation tab only when the browser path completed login.
      if (wasPending && this.state === 'connected' && !this.manualViewed && !this.successOpened) {
        this.successOpened = true;
        void this.open(this.successUrl()).catch(() => false);
      }
      return;
    }
    if (url.pathname === `${this.secretPath}/status` && req.method === 'GET')
      return this.send(res, 200, { state: this.state, error: this.lastError?.message });
    if (url.pathname === `${this.secretPath}/manual` && req.method === 'GET') {
      this.manualViewed = true;
      const nonce = randomBytes(24).toString('base64');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; font-src 'self'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      });
      res.end(
        `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход в PT AI MCP</title>${pageStyle(nonce)}</head><body><main class="root"><div class="pt-logo">${logoSvg}</div><h1 id="heading">Вход в AIE</h1><p id="status" class="subheader" role="status">Ожидаем вход в браузере…</p><div id="manual" class="description-block"><p>Если AIE показал код, введите его здесь.</p><form><label for="code">Код авторизации</label><input id="code" type="password" autocomplete="off" required maxlength="8192"><button type="submit">Продолжить</button></form><p class="hint">Не передавайте код агенту.</p></div><div id="done" class="description-block" hidden><p>Подключение к AIE установлено. Эту вкладку можно закрыть.</p><p class="server">Сервер: ${html(this.origin)}</p></div></main><script nonce="${nonce}">const form=document.querySelector('form'),input=document.querySelector('input'),status=document.querySelector('#status'),heading=document.querySelector('#heading'),manual=document.querySelector('#manual'),done=document.querySelector('#done');async function poll(){const r=await fetch('./status',{cache:'no-store'});const v=await r.json();const labels={waiting:'Ожидаем вход в браузере…',exchanging:'Проверяем код…',connected:'Теперь можно вернуться к вашему агенту.',cancelled:'Вход отменён.',expired:'Время входа истекло. Начните новую попытку в агенте.',failed:'Не удалось завершить вход.'};status.textContent=(labels[v.state]||v.state)+(v.error?' — '+v.error:'');if(!['waiting','exchanging'].includes(v.state)){if(v.state==='connected'){heading.textContent='Успешный вход';manual.hidden=true;done.hidden=false}else form.hidden=true;clearInterval(timer)}}form.addEventListener('submit',async e=>{e.preventDefault();const code=input.value;input.value='';await fetch('./submit',{method:'POST',headers:{'Content-Type':'application/json','X-PTAI-Login':'${this.stateToken}'},body:JSON.stringify({code})});await poll()});const timer=setInterval(()=>poll().catch(()=>{status.textContent='Локальная страница входа закрыта.';clearInterval(timer)}),3000);poll().catch(()=>{});</script></body></html>`,
      );
      return;
    }
    if (url.pathname === `${this.secretPath}/success` && req.method === 'GET') {
      if (this.state !== 'connected') return this.send(res, 409, { error: 'Sign-in is not complete.' });
      const nonce = randomBytes(24).toString('base64');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'`,
      });
      res.end(
        `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход в PT AI MCP выполнен</title>${pageStyle(nonce)}</head><body><main class="root"><div class="pt-logo">${logoSvg}</div><h1>Успешный вход</h1><p class="subheader">Теперь вы можете вернуться к вашему агенту.</p><div class="description-block"><p>Подключение к AIE установлено. Эту вкладку можно закрыть.</p><p class="server">Сервер: ${html(this.origin)}</p></div></main></body></html>`,
      );
      return;
    }
    if (url.pathname === `${this.secretPath}/submit` && req.method === 'POST') {
      if (
        origin !== this.base ||
        req.headers['x-ptai-login'] !== this.stateToken ||
        !req.headers['content-type']?.startsWith('application/json')
      )
        return this.send(res, 403, { error: 'Invalid form origin or token.' });
      let body = '';
      for await (const chunk of req) {
        body += String(chunk);
        if (Buffer.byteLength(body) > 16_384) return this.send(res, 413, { error: 'Input too large.' });
      }
      const value = JSON.parse(body) as { code?: unknown };
      if (typeof value.code !== 'string') return this.send(res, 400, { error: 'Code required.' });
      this.manualViewed = true;
      await this.exchange(value.code);
      return this.send(res, 200, { state: this.state });
    }
    this.send(res, 404, { error: 'Not found.' });
  }
}
