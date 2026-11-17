import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sessions } from '../../../src/aie/auth/session.js';
import { SessionCodec } from '../../../src/aie/auth/session-codec.js';
import { SessionStorage } from '../../../src/aie/auth/session-storage.js';
import { AieDispatcher } from '../../../src/aie/mcp/dispatcher.js';
import { parseToolCall } from '../../../src/aie/mcp/validation.js';
import { cascadeMatch } from '../../../src/aie/projects/text-matcher.js';
import { Operations } from '../../../src/aie/runtime/operations.js';
import { Scans } from '../../../src/aie/scans/scan-service.js';
import { AieFixture, ids } from '../../fixtures/aie-server.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(cleanups.splice(0).map((run) => run()));
});
const branch = { project_id: ids.project, branch_id: ids.branch };
const scan = { ...branch, scan_id: ids.scan };
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-refinements-'));
  const server = new AieFixture();
  const storage = new SessionStorage(path.join(root, 'shared'), new SessionCodec('dev', 'HOST'));
  await storage.write({
    AccessToken: 'synthetic',
    RefreshToken: 'synthetic-refresh',
    EnterpriseApiUri: 'https://aie.test',
  });
  const sessions = new Sessions(storage, (_origin, token) => server.api(token));
  const dispatcher = new AieDispatcher(sessions, {
    invocation: vi.fn(),
    action: vi.fn(),
    close: async () => undefined,
  });
  cleanups.push(async () => {
    await dispatcher.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const call = async (name: string, args: Record<string, unknown>) => await dispatcher.call(name, args);
  return { server, dispatcher, sessions, root, call };
}
async function terminal(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  let response: Record<string, unknown> = {};
  await vi.waitFor(async () => {
    response = (await f.call('aie_get_operation', { operation_id: id })).structuredContent!;
    expect(['succeeded', 'failed', 'cancelled']).toContain(response.state);
  });
  return response;
}

describe('refined public contracts', () => {
  it('preserves confirmed scan identity when deferred cancellation loses its stop response', async () => {
    const server = new AieFixture();
    const request = server.request;
    let cancelled = false;
    server.request = async (url, init) => {
      if (String(url).endsWith('/stop')) {
        throw new TypeError('Lost stop response');
      }
      const response = await request(url, init);
      if (String(url).endsWith('/scanQueue/items') && init?.method === 'POST') {
        cancelled = true;
      }
      return response;
    };
    const remembered = vi.fn();
    const scans = new Scans(server.api(), new Map());
    const response = await scans.start(ids.project, ids.branch, 'Full', undefined, {
      signal: new AbortController().signal,
      check() {},
      stage() {},
      applied() {},
      remember: remembered,
      cancellationRequested: () => cancelled,
    });
    expect(response).toMatchObject({
      scan_id: server.queueScanId,
      correlation: 'queue',
      effects: 'applied',
      cancellation_pending: true,
      stop_result: {
        stop_requested: null,
        stop_confirmed: false,
        effects: 'unknown',
        error: { code: 'AIE_NETWORK_ERROR' },
      },
    });
    expect(response).not.toHaveProperty('refresh_error');
    expect(remembered).toHaveBeenCalledWith({ scan_id: server.queueScanId, correlation: 'queue' });
  });
  it('rejects retired names, mixed targets, invalid labels and branch-wide settings in create', () => {
    for (const name of ['aie_create_project', 'aie_get_scan_status', 'aie_stop_scan']) {
      expect(() => parseToolCall(name, {})).toThrow();
    }
    expect(() => parseToolCall('aie_get_operation', { operation_id: 'x', ...scan })).toThrow();
    expect(() => parseToolCall('aie_start_scan', { ...branch, label_suffix: 'a:b' })).toThrow();
    expect(() => parseToolCall('aie_start_scan', { ...branch, label_suffix: 'a'.repeat(37) })).toThrow();
    expect(() =>
      parseToolCall('aie_create', {
        kind: 'branch',
        project_id: ids.project,
        branch_name: 'feature',
        source_directory: '.',
        scan_changes: {},
      }),
    ).toThrow();
    expect(() => parseToolCall('aie_list_issues', { ...scan, issue_type: ['SQL Injection'] })).toThrow();
  });
  it('creates a populated branch without writing user selection or shared settings', async () => {
    const f = await fixture();
    const source = path.join(f.root, 'sources');
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, 'main.js'), 'synthetic source');
    const created = await f.call('aie_create', {
      kind: 'branch',
      project_id: ids.project,
      branch_name: 'feature',
      source_directory: source,
    });
    const result = await terminal(f, String(created.structuredContent!.operation_id));
    expect(result).toMatchObject({
      state: 'succeeded',
      result: {
        branch_id: ids.branch,
        sources_ready: true,
        working_branch_selection_changed: false,
        default_branch_before: ids.branch,
        default_branch_after: ids.branch,
      },
    });
    expect(f.server.calls.filter((call) => call.method === 'POST').map((call) => call.path)).toEqual([
      `/api/projects/${ids.project}/branches`,
      `/api/store/${ids.project}/branches/${ids.branch}/sources`,
    ]);
  });
  it('does not enqueue a bare empty branch despite a positive source date', async () => {
    const f = await fixture();
    f.server.hasSources = false;
    const response = await f.call('aie_start_scan', branch);
    expect(response).toMatchObject({ isError: true, structuredContent: { error: { code: 'AIE_SOURCES_NOT_READY' } } });
    expect(f.server.calls.some((call) => call.path === '/api/scanQueue/items')).toBe(false);
  });
  it('returns scan ID in the launch call, keeps readable labels and separates workflow/scan state', async () => {
    const f = await fixture();
    const launched = await f.call('aie_start_scan', { ...branch, label_suffix: 'SCA_SCAN' });
    expect(launched.structuredContent).toMatchObject({
      scan_id: f.server.queueScanId,
      scan_label: 'MCP-SCA_SCAN',
      workflow_state: 'succeeded',
      state: 'queued',
      accepted: true,
      correlation: 'queue',
    });
    const read = await f.call('aie_get_operation', { operation_id: launched.structuredContent!.operation_id });
    expect(read.structuredContent).toMatchObject({ workflow_state: 'succeeded', scan_state: 'queued' });
    const plain = await f.call('aie_start_scan', branch);
    expect(plain.structuredContent).toMatchObject({ scan_label: 'MCP' });
  });
  it('requires explicit scan selection for inferred stop and supports external runs', async () => {
    const f = await fixture();
    f.server.queueMode = 'assigned';
    const launched = await f.call('aie_start_scan', branch);
    expect(launched.structuredContent).toMatchObject({ correlation: 'branch_history', scan_id: f.server.queueScanId });
    const cancelled = await f.call('aie_cancel_operation', { operation_id: launched.structuredContent!.operation_id });
    expect(cancelled.structuredContent).toMatchObject({
      stop_requested: false,
      remote_error: { code: 'AIE_SCAN_CORRELATION_REQUIRED' },
    });
    expect(f.server.calls.some((call) => call.path.endsWith('/stop'))).toBe(false);
    const explicit = await f.call('aie_cancel_operation', { ...branch, scan_id: f.server.queueScanId });
    expect(explicit.structuredContent).toMatchObject({ stop_requested: true, stop_confirmed: false });
  });
  it('retains launch results offline and distinguishes a lost stop response', async () => {
    const f = await fixture();
    const launched = await f.call('aie_start_scan', branch);
    const id = launched.structuredContent!.operation_id;
    f.server.faults.set(`POST /api/scans/${f.server.queueScanId}/stop`, { status: 503 });
    expect((await f.call('aie_cancel_operation', { operation_id: id })).structuredContent).toMatchObject({
      effects: 'unknown',
      stop_requested: null,
    });
    f.server.faults.set('GET /api/versions/package/current', { status: 503 });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    const local = await f.call('aie_get_operation', { operation_id: id });
    vi.restoreAllMocks();
    expect(local.structuredContent).toMatchObject({
      state: 'succeeded',
      remote_refresh_error: { code: 'AIE_SERVER_ERROR' },
    });
  });
  it('marks in-flight enqueue uncertainty in both get and cancel views', async () => {
    const operations = new Operations();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const job = operations.start('owner', 'aie_start_scan', 'branch', async (context) => {
      context.stage('queueing_scan');
      await pending;
      return {};
    });
    await Promise.resolve();
    expect(operations.get('owner', job.operation_id)).toMatchObject({
      stage: 'queueing_scan',
      effects: 'unknown',
      cancel_requested: false,
    });
    expect(operations.cancel('owner', job.operation_id)).toMatchObject({ effects: 'unknown', cancel_requested: true });
    release();
    await operations.close();
  });
});

describe('BE4P type matching and bounded result sets', () => {
  it('prefers exact, then substring, then all tokens within one field', () => {
    const values = [
      ['SQL Injection', 'SQL Injection'],
      ['SQL Injection Blind', 'blind SQL'],
      ['Potential Path Traversal', 'Improper Limitation of a Pathname to a Restricted Directory'],
      ['SCA', 'lodash 4.17.11'],
    ];
    expect(cascadeMatch(values, (v) => v, 'sql injection')).toEqual([values[0]]);
    expect(cascadeMatch(values, (v) => v, 'Injection')).toHaveLength(2);
    expect(cascadeMatch(values, (v) => v, 'Directory Pathname')).toEqual([values[2]]);
    expect(cascadeMatch(values, (v) => v, 'lodash')).toEqual([values[3]]);
    expect(cascadeMatch([['foo', 'bar']], (v) => v, 'foo bar')).toEqual([]);
    expect(cascadeMatch(values, (v) => v, 'not-present')).toEqual([]);
  });
  it('searches cached CWE titles and component names without full details requests', async () => {
    const f = await fixture();
    f.server.issue.type = 'Potential Path Traversal';
    f.server.titles.set('Potential Path Traversal', 'Improper Limitation of a Pathname to a Restricted Directory');
    f.server.issues = [f.server.issue, { ...f.server.issue, id: ids.agent }];
    const response = await f.call('aie_list_issues', { ...scan, type: 'Directory Pathname' });
    expect(response.structuredContent).toMatchObject({
      matched_issues: 2,
      search: { description_lookups_complete: true },
    });
    expect(f.server.calls.filter((call) => call.path.endsWith('/resources'))).toHaveLength(1);
    expect(f.server.calls.some((call) => call.path === `/api/projects/${ids.project}/issues/${ids.issue}`)).toBe(false);
  });
  it('paginates the second 100 findings and summarizes the entire filtered selection', async () => {
    const f = await fixture();
    f.server.issues = Array.from({ length: 205 }, (_, index) => ({
      ...f.server.issue,
      id: `bbbbbbbb-bbbb-bbbb-bbbb-${String(index).padStart(12, '0')}`,
      approvalState: index < 5 ? 'Discard' : 'None',
    }));
    const first = await f.call('aie_list_issues', { ...scan, page_size: 100 });
    const next = await f.call('aie_list_issues', {
      ...scan,
      page_size: 100,
      cursor: first.structuredContent!.next_cursor,
    });
    expect(first.structuredContent).toMatchObject({ total: 205, returned: 100, complete: false });
    expect(next.structuredContent).toMatchObject({ total: 205, returned: 100, offset: 100 });
    const summary = await f.call('aie_list_issues', { ...scan, view: 'summary', page_size: 100 });
    expect(summary.structuredContent).toMatchObject({ matched_issues: 205 });
    expect(summary.structuredContent!.items).toContainEqual({ group: 'approval_state', value: 'Discard', count: 5 });
    expect(JSON.stringify(summary).length).toBeLessThan(JSON.stringify(first).length / 3);
  });
  it('matches exact file/line within the same source or entry point', async () => {
    const f = await fixture();
    f.server.issue.sourceEndLine = 9;
    f.server.issue.entryPointFile = 'entry.js';
    f.server.issue.entryPointLine = 50;
    expect(
      (await f.call('aie_list_issues', { ...scan, file: 'SRC\\main.js', start_line: 8, location: 'source' }))
        .structuredContent,
    ).toMatchObject({ total: 1 });
    expect(
      (await f.call('aie_list_issues', { ...scan, file: 'entry.js', start_line: 8 })).structuredContent,
    ).toMatchObject({ total: 0 });
  });
  it('uses comment endpoint for unchanged status and makes empty comment a no-op', async () => {
    const f = await fixture();
    const target = { ...scan, issue_id: ids.issue, state: 'None' };
    const comment = await f.call('aie_triage_issue', { ...target, comment: 'Reviewed without a verdict.' });
    expect(comment.structuredContent).toMatchObject({ verified: true, verification_scope: 'selected_issue_only' });
    expect(f.server.calls.filter((call) => call.method === 'PUT').map((call) => call.path)).toEqual([
      `/api/projects/${ids.project}/issues/${ids.issue}/comment`,
    ]);
    const noop = await f.call('aie_triage_issue', { ...target, comment: '' });
    expect(noop.structuredContent).toMatchObject({ no_op: true, effects: 'not_applied' });
  });
  it('reads bounded file ranges and paged tree with honest source provenance', async () => {
    const f = await fixture();
    const result = await f.call('aie_get_sources', {
      ...scan,
      kind: 'file',
      path: 'main.js',
      start_line: 2,
      end_line: 2,
    });
    expect(result.structuredContent).toMatchObject({
      content: 'second line',
      returned_lines: 1,
      content_source: 'current_branch_sources_or_temp',
      snapshot_match: 'unknown',
      truncated: true,
    });
    const beyond = await f.call('aie_get_sources', { ...branch, kind: 'file', path: 'main.js', start_line: 100 });
    expect(beyond.structuredContent).toMatchObject({ returned_lines: 0, end_line: null });
    const tree = await f.call('aie_get_sources', { ...branch, kind: 'tree' });
    expect(tree.structuredContent).toMatchObject({ total: 1, items: [{ path: 'main.js', kind: 'file' }] });
    expect((await f.call('aie_get_sources', { ...branch, kind: 'file', path: '../secret' })).isError).toBe(true);
  });
});

describe('launch timing and review regressions', () => {
  it('returns a fallback at the 45 second budget without repeating an in-flight enqueue', async () => {
    const f = await fixture();
    const request = f.server.request;
    let release: (() => void) | undefined;
    f.server.request = async (url, init) => {
      const response = await request(url, init);
      if (String(url).endsWith('/api/scanQueue/items') && init?.method === 'POST') {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return response;
    };
    await f.sessions.require();
    vi.useFakeTimers();
    const pending = f.call('aie_start_scan', branch);
    await vi.waitFor(() => expect(release).toBeDefined());
    await vi.advanceTimersByTimeAsync(45_000);
    const response = await pending;
    expect(response.structuredContent).toMatchObject({
      effects: 'unknown',
      accepted: null,
      correlation: 'unconfirmed',
    });
    expect(response.structuredContent!.operation_id).toBeTypeOf('string');
    release!();
    vi.useRealTimers();
    await terminal(f, String(response.structuredContent!.operation_id));
    expect(
      f.server.calls.filter((call) => call.method === 'POST' && call.path === '/api/scanQueue/items'),
    ).toHaveLength(1);
  });
  it('keeps exact operation correlation after its transient run cache is cleared', async () => {
    const f = await fixture();
    const launched = await f.call('aie_start_scan', branch);
    f.server.queueMode = 'missing';
    const field = f.dispatcher as unknown as { runs: Map<string, unknown> };
    field.runs.clear();
    const read = await f.call('aie_get_operation', { operation_id: launched.structuredContent!.operation_id });
    expect(read.structuredContent).toMatchObject({ remote: { scan_id: f.server.queueScanId, correlation: 'queue' } });
    const cancelled = await f.call('aie_cancel_operation', { operation_id: launched.structuredContent!.operation_id });
    expect(cancelled.structuredContent).toMatchObject({ stop_requested: true });
  });
  it('reports missing comment baseline as unavailable rather than a proven mismatch', async () => {
    const f = await fixture();
    f.server.faults.set(`GET /api/history/branches/${ids.branch}`, { status: 503 });
    f.server.onWrite = () => f.server.faults.clear();
    const result = await f.call('aie_triage_issue', {
      ...scan,
      issue_id: ids.issue,
      state: 'Approval',
      comment: 'reviewed',
    });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'AIE_READBACK_UNAVAILABLE', effects: 'applied', failed_check: 'comment' } },
    });
  });
  it('does not reuse fingerprint titles across different resource identities', async () => {
    const f = await fixture();
    f.server.issues = [
      { ...f.server.issue, issueType: 'Fingerprint' },
      { ...f.server.issue, id: ids.agent, issueType: 'Fingerprint' },
    ];
    f.server.titles.set(ids.issue, 'Alpha fingerprint');
    f.server.titles.set(ids.agent, 'Beta fingerprint');
    const response = await f.call('aie_list_issues', { ...scan, type: 'Alpha' });
    expect(response.structuredContent).toMatchObject({ matched_issues: 1, items: [{ id: ids.issue }] });
    expect(f.server.calls.filter((call) => call.path.endsWith('/resources'))).toHaveLength(2);
  });
});

describe('source API compatibility fallback', () => {
  it('reads a bounded tree and file from the branch archive if source routes are absent', async () => {
    const f = await fixture();
    f.server.faults.set(`GET /api/directoryContent/${ids.project}/branches/${ids.branch}`, { status: 404, body: {} });
    f.server.faults.set(`GET /api/fileContent/${ids.project}/branches/${ids.branch}/main.js`, {
      status: 404,
      body: {},
    });
    const tree = await f.call('aie_get_sources', { ...branch, kind: 'tree' });
    expect(tree.structuredContent).toMatchObject({
      fetch_source: 'branch_archive_fallback',
      total: 1,
      items: [{ path: 'main.js', kind: 'file' }],
    });
    const file = await f.call('aie_get_sources', { ...branch, kind: 'file', path: 'main.js' });
    expect(file.structuredContent).toMatchObject({
      fetch_source: 'branch_archive_fallback',
      content: 'synthetic source',
      snapshot_match: 'unknown',
    });
  });
  it('rejects a corrupted source entry checksum in archive fallback', async () => {
    const f = await fixture();
    const request = f.server.request;
    f.server.request = async (url, init) => {
      const response = await request(url, init);
      if (String(url).includes('/fileContent/')) {
        return new Response(null, { status: 404 });
      }
      if (String(url).includes('/sources') && init?.method === 'GET') {
        const bytes = Buffer.from(await response.arrayBuffer());
        const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
        bytes[central + 16] ^= 1;
        return new Response(bytes);
      }
      return response;
    };
    const result = await f.call('aie_get_sources', { ...branch, kind: 'file', path: 'main.js' });
    expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'AIE_INVALID_ARCHIVE' } } });
  });
});
