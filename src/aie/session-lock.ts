import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { AieError } from './errors.js';

/** Interoperability protocol shared with BE4P: exclusive creation of
 * shared_variables.session-lock containing {pid,nonce}. Never expire a live
 * owner based only on time: an HTTP refresh can legitimately take 60 seconds. */
export async function withSessionLock<T>(file: string, action: () => Promise<T>, timeoutMs = 10_000): Promise<T> {
  const lockPath = `${file}.session-lock`;
  const owner = { pid: process.pid, nonce: randomUUID() };
  const started = Date.now();
  while (true) {
    try {
      const handle = await fs.open(lockPath, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify(owner));
      } finally {
        await handle.close();
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
        throw new AieError(
          'AIE_SESSION_UNWRITABLE',
          'Could not acquire the shared-session file lock. Check directory permissions.',
        );
      await removeDeadOwner(lockPath);
      if (Date.now() - started >= timeoutMs)
        throw new AieError('AIE_SESSION_BUSY', 'Another process is updating the shared session. Retry shortly.', {
          retryable: true,
        });
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  try {
    return await action();
  } finally {
    await releaseLock(lockPath, owner.nonce);
  }
}

async function releaseLock(lockPath: string, nonce: string) {
  try {
    const current = JSON.parse(await fs.readFile(lockPath, 'utf8')) as { nonce?: string };
    if (current.nonce === nonce) await fs.unlink(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function removeDeadOwner(file: string) {
  try {
    const text = await fs.readFile(file, 'utf8');
    const stat = await fs.stat(file);
    let owner: { pid?: number; nonce?: string };
    try {
      owner = JSON.parse(text) as typeof owner;
    } catch {
      if (Date.now() - stat.mtimeMs > 30_000 && (await fs.readFile(file, 'utf8')) === text) await fs.unlink(file);
      return;
    }
    if (!Number.isSafeInteger(owner.pid) || owner.pid! <= 0) return;
    try {
      process.kill(owner.pid!, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH' && (await fs.readFile(file, 'utf8')) === text)
        await fs.unlink(file);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
