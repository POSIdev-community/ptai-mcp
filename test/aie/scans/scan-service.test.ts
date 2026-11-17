import { describe, expect, it } from 'vitest';
import { ApiErrorType } from '../../../src/aie/api/contracts.js';
import { Scans } from '../../../src/aie/scans/scan-service.js';
import type { TrackedRun } from '../../../src/aie/scans/scan-status.js';
import { AieFixture, ids } from '../../fixtures/aie-server.js';

const historyPath = `/api/branches/${ids.branch}/scanResults`;
const lastPath = `${historyPath}/last`;
const queuePath = `/api/scanQueue/items/${ids.queue}`;

function fixture() {
  const server = new AieFixture();
  server.queueMode = 'missing';
  const candidate = server.scans.get(ids.scan)!;
  candidate.scanLabel = 'MCP';
  candidate.initiator = { id: ids.user };
  const tracked: TrackedRun = {
    projectId: ids.project,
    branchId: ids.branch,
    queueId: ids.queue,
    acceptedAt: '2026-11-12T12:00:00Z',
    before: [],
    label: 'MCP',
    initiatorId: ids.user,
  };
  const runs = new Map([[ids.queue, tracked]]);
  const service = new Scans(server.api(), runs);
  const read = () => service.status(ids.project, ids.branch, ids.queue);
  return { server, candidate, tracked, runs, service, read };
}

describe('history fallback for an unavailable queue item', () => {
  it('remembers a unique match as inferred and still requires explicit scan selection to stop it', async () => {
    const f = fixture();
    expect(await f.read()).toMatchObject({ scan_id: ids.scan, correlation: 'branch_history' });
    expect(f.tracked).toMatchObject({ scanId: ids.scan, correlation: 'branch_history' });
    f.server.faults.set(`GET ${queuePath}`, { status: 503 });
    f.server.faults.set(`GET ${historyPath}`, { status: 503 });
    expect(await f.read()).toMatchObject({ scan_id: ids.scan, correlation: 'branch_history' });
    await expect(f.service.stop(ids.project, ids.branch, ids.queue)).rejects.toMatchObject({
      code: 'AIE_SCAN_CORRELATION_REQUIRED',
      details: { effects: 'not_applied' },
    });
    expect(f.server.calls.every((call) => call.method === 'GET')).toBe(true);
  });

  it('returns ambiguous candidates without attributing or stopping either scan', async () => {
    const f = fixture();
    f.server.scans.set(ids.agent, { ...f.candidate, id: ids.agent });
    expect(await f.read()).toMatchObject({
      scan_id: null,
      correlation: 'unconfirmed',
      candidates: [{ id: ids.scan }, { id: ids.agent }],
    });
    expect(f.tracked.scanId).toBeUndefined();
    await expect(f.service.stop(ids.project, ids.branch, ids.queue)).rejects.toMatchObject({
      code: 'AIE_SCAN_CORRELATION_REQUIRED',
    });
    expect(f.server.calls.every((call) => call.method === 'GET')).toBe(true);
  });

  it.each([
    ['a different label', { scanLabel: 'From IDE' }],
    ['a different known initiator', { initiator: { id: ids.agent } }],
    ['a missing scan ID', { id: undefined }],
  ])('does not infer a scan with %s', async (_description, changes) => {
    const f = fixture();
    Object.assign(f.candidate, changes);
    expect(await f.read()).toMatchObject({ scan_id: null, correlation: 'unconfirmed', candidates: [] });
    expect(f.tracked.scanId).toBeUndefined();
  });

  it.each([undefined, {}])('allows a candidate when the server omits the initiator: %j', async (initiator) => {
    const f = fixture();
    f.candidate.initiator = initiator;
    expect(await f.read()).toMatchObject({ scan_id: ids.scan, correlation: 'branch_history' });
  });

  it.each([undefined, ''])('keeps a candidate unconfirmed without a tracked label: %j', async (label) => {
    const f = fixture();
    f.tracked.label = label;
    expect(await f.read()).toMatchObject({ scan_id: null, correlation: 'unconfirmed', candidates: [{ id: ids.scan }] });
    expect(f.tracked.scanId).toBeUndefined();
  });

  it('does not inspect history without a locally tracked launch', async () => {
    const f = fixture();
    f.runs.clear();
    expect(await f.read()).toMatchObject({ scan_id: null, candidates: [] });
    expect(f.server.calls.some((call) => call.path === lastPath || call.path === historyPath)).toBe(false);
  });

  it('skips the history request when the latest scan is already in the launch snapshot', async () => {
    const f = fixture();
    f.tracked.before.push(ids.scan);
    f.server.faults.set(`GET ${historyPath}`, { status: 503 });
    expect(await f.read()).toMatchObject({ scan_id: null, candidates: [] });
    expect(f.server.calls.some((call) => call.path === lastPath)).toBe(true);
    expect(f.server.calls.some((call) => call.path === historyPath)).toBe(false);
  });

  it('does not select a known scan when it appears beside a new candidate in history', async () => {
    const f = fixture();
    f.tracked.before.push(ids.scan);
    f.server.scans.set(ids.agent, { ...f.candidate, id: ids.agent });
    expect(await f.read()).toMatchObject({ scan_id: ids.agent, correlation: 'branch_history' });
  });

  it('does not inspect history when the queue reports that no result is initialized', async () => {
    const f = fixture();
    f.server.faults.set(`GET ${queuePath}`, { status: 400, body: { errorCode: ApiErrorType.EmptyScanResult } });
    expect(await f.read()).toMatchObject({ scan_id: null, candidates: [] });
    expect(f.server.calls.some((call) => call.path === historyPath)).toBe(false);
  });

  it('falls back to history if the optional last-scan request fails', async () => {
    const f = fixture();
    f.server.faults.set(`GET ${lastPath}`, { status: 503 });
    expect(await f.read()).toMatchObject({ scan_id: ids.scan, correlation: 'branch_history' });
  });

  it('propagates history read failures without remembering a match', async () => {
    const f = fixture();
    f.server.faults.set(`GET ${historyPath}`, { status: 503 });
    await expect(f.read()).rejects.toMatchObject({ code: 'AIE_SERVER_ERROR' });
    expect(f.tracked.scanId).toBeUndefined();
  });

  it('retains inferred identity if reading the selected scan fails', async () => {
    const f = fixture();
    f.server.faults.set(`GET /api/projects/${ids.project}/scanResults/${ids.scan}`, { status: 503 });
    await expect(f.read()).rejects.toMatchObject({ code: 'AIE_SERVER_ERROR' });
    expect(f.tracked).toMatchObject({ scanId: ids.scan, correlation: 'branch_history' });
  });
});
