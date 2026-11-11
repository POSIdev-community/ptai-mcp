import fs from 'node:fs/promises';
import path from 'node:path';
import { AieError } from './errors.js';
import { SessionCodec, sessionFingerprint, type SharedSession } from './session-codec.js';
import { withSessionLock } from './session-lock.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class SessionStorage {
  constructor(
    readonly file: string,
    private readonly codec = new SessionCodec(),
  ) {}

  async read(): Promise<SharedSession | null> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return this.codec.decode(await fs.readFile(this.file, 'utf8'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        // BE4P writes in place. A partial write is not a logout event.
        if (attempt === 9)
          throw new AieError(
            'AIE_SESSION_UNREADABLE',
            'The shared session cannot be read. It has not been overwritten.',
            {
              next_action: 'Check the session file permissions and OS identity; sign in again if needed.',
            },
          );
        await delay(50);
      }
    }
    return null;
  }

  async write(value: SharedSession, expected?: string, beforeCommit?: () => void) {
    await this.withLock(() => this.replace(value, expected, beforeCommit));
  }

  async refresh(expected: string, update: (current: SharedSession) => Promise<SharedSession>): Promise<SharedSession> {
    return this.withLock(async () => {
      const current = await this.read();
      if (!current) throw new AieError('AIE_LOGIN_REQUIRED', 'Shared session was removed.');
      if (sessionFingerprint(current) !== expected) return current;
      const updated = await update(current);
      await this.replace(updated, expected);
      return updated;
    });
  }

  private async replace(value: SharedSession, expected?: string, beforeCommit?: () => void) {
    const encoded = this.codec.encode(value);
    await this.verify(expected);
    beforeCommit?.();
    // Match legacy BE4P File.WriteAllText: its watcher handles Changed only.
    // Atomic rename can be invisible to that watcher or look like a logout.
    // Node readers retry incomplete records; Node writers coordinate via lock.
    // A legacy BE4P does not honor this lock, so cross-runtime refresh remains
    // best-effort until the optional BE4P coordination fix is adopted.
    await fs.writeFile(this.file, encoded, { mode: 0o600 });
  }

  async clear(expected?: string) {
    await this.withLock(async () => {
      await this.verify(expected);
      await fs.rm(this.file, { force: true });
    });
  }

  private async verify(expected?: string) {
    if (expected !== undefined && sessionFingerprint(await this.read()) !== expected) {
      throw new AieError(
        'AIE_CONTEXT_CHANGED',
        'Shared session changed during the operation. The newer record has been preserved.',
      );
    }
  }

  private async withLock<T>(action: () => Promise<T>): Promise<T> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    return withSessionLock(this.file, action);
  }
}
