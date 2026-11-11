import { checkReadback, type Data } from './schema.js';
import { AieError } from './errors.js';

const secrets = [
  ['authentication', 'http', 'password'],
  ['authentication', 'form', 'password'],
  ['authentication', 'cookie', 'cookie'],
  ['proxySettings', 'password'],
];

function parent(value: unknown, path: string[]): Data | undefined {
  for (const key of path.slice(0, -1)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    value = (value as Data)[key];
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Data) : undefined;
}

/** HTTP/Form passwords preserve on omission/null; proxy passwords also preserve
 * on empty string. RawCookie has no preserve sentinel: fail before writing if
 * the server hid it and the caller did not explicitly replace/clear it. */
export function preserveBlackboxSecrets(value: Data, changes: Data) {
  const cookiePath = ['authentication', 'cookie', 'cookie'];
  const currentCookie = parent(value, cookiePath)?.cookie;
  const cookieWasSpecified = Object.hasOwn(parent(changes, cookiePath) ?? {}, 'cookie');
  const type = (value.authentication as Data | undefined)?.type;
  if (
    type === 'RawCookie' &&
    !cookieWasSpecified &&
    (typeof currentCookie !== 'string' || !currentCookie || /^[*•]+$/.test(currentCookie))
  ) {
    throw new AieError(
      'AIE_CREDENTIALS_PRESERVATION_REQUIRED',
      'AIE hides the existing RawCookie and has no preserve sentinel for it. No settings were written.',
      {
        effects: 'not_applied',
        next_action:
          'Supply an explicit replacement cookie, or explicitly disable this authentication type before changing the section.',
      },
    );
  }
  for (const path of secrets) {
    const key = path.at(-1)!;
    if (path[1] === 'cookie') continue;
    if (!Object.hasOwn(parent(changes, path) ?? {}, key)) delete parent(value, path)?.[key];
  }
}

/** Visible fields are checked exactly. A successful write cannot prove the
 * value of a secret that the server hides: expose that verification limit. */
export function verifyBlackboxReadback(saved: unknown, changes: Data) {
  const visible = structuredClone(changes);
  const unverified: string[] = [];
  const preserved: string[] = [];
  for (const path of secrets) {
    const key = path.at(-1)!;
    const requested = parent(changes, path);
    if (!requested || !Object.hasOwn(requested, key)) continue;
    const actual = parent(saved, path)?.[key];
    const preserving =
      path[0] === 'proxySettings'
        ? requested[key] === null || requested[key] === ''
        : path[1] !== 'cookie' && requested[key] === null;
    if (preserving) {
      delete parent(visible, path)?.[key];
      preserved.push(path.join('.'));
      continue;
    }
    if (
      (actual === '' && requested[key] !== '') ||
      actual == null ||
      (typeof actual === 'string' && /^[*•]+$/.test(actual))
    ) {
      delete parent(visible, path)?.[key];
      unverified.push(path.join('.'));
    }
  }
  checkReadback(saved, visible);
  return {
    verified: unverified.length === 0,
    secret_values_verified: unverified.length === 0,
    unverified_fields: unverified,
    preserved_fields: preserved,
  };
}
