import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import os from 'node:os';

export interface SharedSession {
  AccessToken: string;
  RefreshToken: string;
  EnterpriseApiUri: string;
}

function material(value: string, length: number, suffix: string): Buffer {
  let text = value.replace(/[^A-Za-z0-9+/]/g, '') || 'AIEnterprise';
  text += suffix;
  text = text.length < length ? text[0].repeat(length - text.length) + text : text.slice(-length);
  return Buffer.from(text, 'base64');
}

/** Exact BE4P AesCrypt/Crypt format: machine key, user IV, 8-byte salt, AES-CBC/PKCS7. */
export class SessionCodec {
  private readonly iv: Buffer;
  private readonly key: Buffer;

  constructor(user = os.userInfo().username, machine = os.hostname()) {
    this.iv = material(user, 24, '==');
    this.key = material(machine, 44, '=');
  }

  encode(session: SharedSession, salt = randomBytes(8)): string {
    if (salt.length !== 8) throw new Error('Salt must be 8 bytes.');
    const cipher = createCipheriv('aes-256-cbc', this.key, this.iv);
    return Buffer.concat([
      cipher.update(Buffer.concat([salt, Buffer.from(JSON.stringify(session))])),
      cipher.final(),
    ]).toString('base64');
  }

  decode(encoded: string): SharedSession {
    const cipher = createDecipheriv('aes-256-cbc', this.key, this.iv);
    const text = Buffer.concat([cipher.update(Buffer.from(encoded.trim(), 'base64')), cipher.final()])
      .subarray(8)
      .toString('utf8');
    const value = JSON.parse(text) as Partial<SharedSession>;
    if (
      ![value.AccessToken, value.RefreshToken, value.EnterpriseApiUri].every(
        (v) => typeof v === 'string' && v.length > 0,
      )
    ) {
      throw new Error('Invalid shared session.');
    }
    return value as SharedSession;
  }
}

export function sessionFingerprint(value: SharedSession | null) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
