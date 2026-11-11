import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import { NodeErrorCode } from '../../shared/io-constants.js';
import { type SharedSession } from './models.js';
import { SessionCodec, sessionFingerprint } from './session-codec.js';
import { withSessionLock } from './session-lock.js';

export class SessionStorage {

  public constructor(
    public readonly file: string,
    private readonly codec = new SessionCodec(),
  ) {}

  public async read(): Promise<SharedSession | null> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return this.codec.decode(await fs.readFile(this.file, 'utf8'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === NodeErrorCode.NotFound) {
          return null;
        }

        // BE4P writes in place. A partial write is not a logout event.
        if (attempt === 9) {
          throw new ToolError(
            ErrorCode.SessionUnreadable,
            'The shared session cannot be read. It has not been overwritten.',
            {
              next_action: 'Check the session file permissions and OS identity; sign in again if needed.',
            },
          );
        }

        await delay(50);
      }
    }

    return null;
  }

  public async write(value: SharedSession, expected?: string, beforeCommit?: () => void) {
    await this.withLock(() => this.replace(value, expected, beforeCommit));
  }

  public async refresh(
    expected: string,
    update: (current: SharedSession) => Promise<SharedSession>,
  ): Promise<SharedSession> {
    return this.withLock(async () => {
      const current = await this.read();

      if (!current) {
        throw new ToolError(ErrorCode.LoginRequired, 'Shared session was removed.');
      }

      if (sessionFingerprint(current) !== expected) {
        return current;
      }

      const updated = await update(current);
      await this.replace(updated, expected);

      return updated;
    });
  }

  public async clear(expected?: string) {
    await this.withLock(async () => {
      await this.verify(expected);
      await fs.rm(this.file, { force: true });
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

  private async verify(expected?: string) {
    if (expected !== undefined && sessionFingerprint(await this.read()) !== expected) {
      throw new ToolError(
        ErrorCode.ContextChanged,
        'Shared session changed during the operation. The newer record has been preserved.',
      );
    }
  }

  private async withLock<T>(action: () => Promise<T>): Promise<T> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });

    return withSessionLock(this.file, action);
  }
}
