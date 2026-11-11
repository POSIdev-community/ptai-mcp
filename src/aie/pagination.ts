import { createHash, randomUUID } from 'node:crypto';
import { AieError, validation } from './errors.js';
import { LIMITS } from './limits.js';

type PageRequest = { cursor?: string; page_size?: number };
type Snapshot = { binding: string; items: unknown[]; at: string; expires: number; pageSize: number; bytes: number };
type Cursor = { snapshot: Snapshot; offset: number; nextCursor?: string };
const cursorBytes = 512;
const maxCursors = 4096;

export class Pages {
  private readonly cursors = new Map<string, Cursor>();
  private bytes = 0;

  async list(
    identity: string,
    tool: string,
    query: Record<string, unknown>,
    request: PageRequest,
    load: () => Promise<unknown[]>,
  ) {
    this.prune();
    const existing = request.cursor ? this.cursors.get(request.cursor) : undefined;
    const pageSize = request.page_size ?? existing?.snapshot.pageSize ?? LIMITS.pageSize;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > LIMITS.maxPageSize)
      validation('page_size must be between 1 and 100.');
    const binding = createHash('sha256')
      .update(JSON.stringify([identity, tool, query]))
      .digest('hex');
    let cursor: Cursor;
    if (request.cursor) {
      if (!existing || existing.snapshot.binding !== binding || existing.snapshot.pageSize !== pageSize) {
        throw new AieError(
          'AIE_CURSOR_INVALID',
          'Cursor is expired or belongs to another context/query. Restart the list.',
        );
      }
      cursor = existing;
    } else {
      const items = await load();
      const size = Buffer.byteLength(JSON.stringify(items));
      if (size > LIMITS.jsonBytes || this.bytes + size > LIMITS.jsonBytes) {
        throw new AieError(
          'AIE_LIST_LIMIT',
          'List snapshots exceed the memory limit. Narrow the query or wait for cursor expiry.',
        );
      }
      const snapshot: Snapshot = {
        binding,
        items,
        at: new Date().toISOString(),
        expires: Date.now() + LIMITS.cursorTtlMs,
        pageSize,
        bytes: size,
      };
      cursor = { snapshot, offset: 0 };
    }
    const { snapshot, offset } = cursor;
    const items = snapshot.items.slice(offset, offset + pageSize);
    const hasMore = offset + items.length < snapshot.items.length;
    // Cursors are immutable: retrying a page cannot silently advance the result.
    let nextCursor: string | null = null;
    if (hasMore) {
      const size = request.cursor ? 0 : snapshot.bytes;
      if (!cursor.nextCursor && (this.bytes + size + cursorBytes > LIMITS.jsonBytes || this.cursors.size >= maxCursors))
        throw new AieError('AIE_LIST_LIMIT', 'Cursor memory limit reached. Restart with a narrower query.');
      if (!cursor.nextCursor) {
        cursor.nextCursor = randomUUID();
        this.cursors.set(cursor.nextCursor, { snapshot, offset: offset + items.length });
        this.bytes += size + cursorBytes;
      }
      nextCursor = cursor.nextCursor;
    }
    return {
      items,
      next_cursor: nextCursor,
      total: snapshot.items.length,
      returned: items.length,
      offset,
      pagination: 'client_snapshot',
      filtering: 'client',
      complete: !hasMore,
      read_at: snapshot.at,
    };
  }

  clear() {
    this.cursors.clear();
    this.bytes = 0;
  }

  private prune() {
    for (const [key, cursor] of this.cursors) if (cursor.snapshot.expires <= Date.now()) this.cursors.delete(key);
    const snapshots = new Set([...this.cursors.values()].map((cursor) => cursor.snapshot));
    this.bytes = this.cursors.size * cursorBytes + [...snapshots].reduce((size, snapshot) => size + snapshot.bytes, 0);
  }
}
