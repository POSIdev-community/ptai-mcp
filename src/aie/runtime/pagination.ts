import { createHash, randomUUID } from 'node:crypto';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import { LIMITS } from '../../shared/limits.js';

const cursorBytes = 512;
const maxCursors = 4096;

export class Pages {

  private readonly cursors = new Map<string, Cursor>();
  private bytes = 0;

  public async list(
    identity: string,
    tool: string,
    query: Record<string, unknown>,
    request: PageRequest,
    load: () => Promise<unknown[]>,
  ) {
    this.prune();

    const existing = request.cursor ? this.cursors.get(request.cursor) : undefined;
    const pageSize = request.page_size ?? existing?.snapshot.pageSize ?? LIMITS.pageSize;

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > LIMITS.maxPageSize) {
      validation('page_size must be between 1 and 100.');
    }

    const binding = createHash('sha256')
      .update(JSON.stringify([identity, tool, query]))
      .digest('hex');

    let cursor: Cursor;

    if (request.cursor) {
      if (!existing || existing.snapshot.binding !== binding || existing.snapshot.pageSize !== pageSize) {
        throw new ToolError(
          ErrorCode.CursorInvalid,
          'Cursor is expired or belongs to another context/query. Restart the list.',
        );
      }

      cursor = existing;
    } else {
      const snapshot = await this.loadSnapshot(binding, pageSize, load);
      cursor = { snapshot, offset: 0 };
    }

    const { snapshot, offset } = cursor;
    const items = snapshot.items.slice(offset, offset + pageSize);
    const hasMore = offset + items.length < snapshot.items.length;
    const nextCursor = this.nextCursor(cursor, request, offset + items.length);

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

  public clear() {
    this.cursors.clear();
    this.bytes = 0;
  }

  private prune() {
    for (const [key, cursor] of this.cursors) {
      if (cursor.snapshot.expires <= Date.now()) {
        this.cursors.delete(key);
      }
    }

    const snapshots = new Set([...this.cursors.values()].map((cursor) => cursor.snapshot));
    this.bytes = this.cursors.size * cursorBytes + [...snapshots].reduce((size, snapshot) => size + snapshot.bytes, 0);
  }

  private nextCursor(cursor: Cursor, request: PageRequest, nextOffset: number): string | null {
    const { snapshot } = cursor;

    if (nextOffset >= snapshot.items.length) {
      return null;
    }

    // Cursors are immutable: retrying a page cannot silently advance the result.
    const size = request.cursor ? 0 : snapshot.bytes;

    if (!cursor.nextCursor && (this.bytes + size + cursorBytes > LIMITS.jsonBytes || this.cursors.size >= maxCursors)) {
      throw new ToolError(ErrorCode.ListLimit, 'Cursor memory limit reached. Restart with a narrower query.');
    }

    if (!cursor.nextCursor) {
      cursor.nextCursor = randomUUID();
      this.cursors.set(cursor.nextCursor, { snapshot, offset: nextOffset });
      this.bytes += size + cursorBytes;
    }

    return cursor.nextCursor;
  }

  private async loadSnapshot(binding: string, pageSize: number, load: () => Promise<unknown[]>): Promise<Snapshot> {
    const items = await load();
    const size = Buffer.byteLength(JSON.stringify(items));

    if (size > LIMITS.jsonBytes || this.bytes + size > LIMITS.jsonBytes) {
      throw new ToolError(
        ErrorCode.ListLimit,
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

    return snapshot;
  }
}

type PageRequest = { cursor?: string; page_size?: number };
type Snapshot = { binding: string; items: unknown[]; at: string; expires: number; pageSize: number; bytes: number };
type Cursor = { snapshot: Snapshot; offset: number; nextCursor?: string };
