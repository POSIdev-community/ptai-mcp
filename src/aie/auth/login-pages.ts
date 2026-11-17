import { existsSync, readFileSync } from 'node:fs';
import { HttpHeader } from '../../shared/http-constants.js';
import { AIE_INSECURE_TLS_ORIGINS_ENV } from '../api/transport.js';
import { loginLanguage, loginTranslations } from './login-language.js';

// Source modules and the bundled CLI have different locations. Both layouts
// contain the same complete asset directory; lookup never accepts a user path.
const assetDirectory = [
  new URL('./assets/aie-login/', import.meta.url),
  new URL('../../../assets/aie-login/', import.meta.url),
].find((directory) => existsSync(directory));

if (!assetDirectory) {
  throw new Error('The AIE login assets are missing from this installation.');
}

const readAsset = (name: string) => readFileSync(new URL(name, assetDirectory));
const logo = readAsset('ai_casgate_logo.svg').toString('utf8');
const templates = {
  manual: readAsset('manual.html').toString('utf8'),
  success: readAsset('success.html').toString('utf8'),
};

const publicAssets = new Map([
  ['Inter-Regular.woff2', { contentType: 'font/woff2', body: readAsset('Inter-Regular.woff2') }],
  ['TT-Positive-Regular.woff2', { contentType: 'font/woff2', body: readAsset('TT-Positive-Regular.woff2') }],
  ['login.css', { contentType: 'text/css; charset=utf-8', body: readAsset('login.css') }],
  ['manual.js', { contentType: 'text/javascript; charset=utf-8', body: readAsset('manual.js') }],
]);

export const loginPageHeaders = {
  [HttpHeader.ContentType]: 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

export function getLoginAsset(name: string) {
  return publicAssets.get(name);
}

export function renderLoginPage(page: keyof typeof templates, origin: string, token = '', acceptLanguage = ''): string {
  const language = loginLanguage(acceptLanguage);
  const values: Record<string, string> = {
    ...loginTranslations[language],
    lang: language,
    server: origin,
    token,
    caExample: JSON.stringify({ env: { NODE_EXTRA_CA_CERTS: '<trusted-ca.pem>' } }, null, 2),
    insecureExample: JSON.stringify({ env: { [AIE_INSECURE_TLS_ORIGINS_ENV]: origin } }, null, 2),
  };

  return templates[page].replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key === 'logo' ? logo : escapeHtml(values[key] ?? ''),
  );
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return value.replace(/[&<>"']/g, (character) => entities[character]);
}
