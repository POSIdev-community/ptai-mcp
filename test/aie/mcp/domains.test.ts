import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sessions } from '../../../src/aie/auth/session.js';
import { SessionCodec } from '../../../src/aie/auth/session-codec.js';
import { SessionStorage } from '../../../src/aie/auth/session-storage.js';
import { AieDispatcher } from '../../../src/aie/mcp/dispatcher.js';
import { PmCatalog } from '../../../src/aie/pm/catalog.js';
import { Findings } from '../../../src/aie/projects/findings.js';
import { Pages } from '../../../src/aie/runtime/pagination.js';
import { Scans } from '../../../src/aie/scans/scan-service.js';
import { Settings } from '../../../src/aie/settings/project-settings.js';
import { revision } from '../../../src/shared/json.js';
import type { Telemetry } from '../../../src/telemetry/types.js';
import { AieFixture, ids } from '../../fixtures/aie-server.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((run) => run()));
});
const project = { project_id: ids.project };
const branch = { ...project, branch_id: ids.branch };
const selected = { ...branch, scan_id: ids.scan, issue_id: ids.issue };

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-domain-'));
  const server = new AieFixture();
  const storage = new SessionStorage(path.join(root, 'shared_variables'), new SessionCodec('dev.user', 'HOST-01'));
  await storage.write({
    AccessToken: 'synthetic-access',
    RefreshToken: 'synthetic-refresh',
    EnterpriseApiUri: 'https://aie.test',
  });
  const sessions = new Sessions(
    storage,
    (_origin, token) => server.api(token),
    (identity) => dispatcher?.operations.cancelIdentity(identity),
  );
  const telemetry: Telemetry = { invocation: vi.fn(), action: vi.fn(), close: vi.fn(async () => undefined) };
  const dispatcher = new AieDispatcher(sessions, telemetry);
  cleanup.push(async () => {
    await dispatcher.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const call = async (name: string, args: Record<string, unknown> = {}) => dispatcher.call(name, args);
  return { root, server, storage, sessions, telemetry, dispatcher, call };
}

async function terminal(dispatcher: AieDispatcher, operationId: string) {
  let value: Record<string, unknown> = {};
  await vi.waitFor(async () => {
    const response = await dispatcher.call('aie_get_operation', { operation_id: operationId });
    value = response.structuredContent!;
    expect(['succeeded', 'failed', 'cancelled']).toContain(value.state);
  });
  return value;
}

describe('AIE dispatcher browsing, context and triage', () => {
  it('reads project/branch/scan/issues/details and all catalog kinds through generated HTTP clients', async () => {
    const f = await fixture();
    for (const [name, args] of [
      ['aie_get_context', {}],
      ['aie_list_projects', { name: 'fixture' }],
      ['aie_list_branches', project],
      ['aie_list_scans', branch],
      ['aie_list_issues', { ...branch, scan_id: ids.scan, severity: ['High'], is_new: false, path: 'src/' }],
      ['aie_get_issue_details', selected],
      ['aie_list_scan_agents', {}],
      ['aie_list_scan_agents', { id: ids.agent }],
      ['aie_list_pm_catalog', { kind: 'rules', include_create_schema: true }],
      ['aie_list_pm_catalog', { kind: 'groups' }],
      ['aie_list_pm_catalog', { kind: 'types' }],
      ['aie_get_pm_catalog_entry', { kind: 'rules', id: 'custom-rule' }],
      ['aie_get_pm_catalog_entry', { kind: 'groups', id: ids.group }],
      ['aie_get_pm_catalog_entry', { kind: 'types', id: ids.type }],
    ] as Array<[string, Record<string, unknown>]>) {
      const response = await f.call(name, args);
      expect(response.isError, name).not.toBe(true);
    }
    expect(f.telemetry.invocation).toHaveBeenCalledTimes(14);
    expect(f.server.calls.every((call) => call.authorization?.startsWith('Bearer '))).toBe(true);
  });
  it('verifies triage status and the latest history comment', async () => {
    const f = await fixture();
    const response = await f.call('aie_triage_issue', {
      ...selected,
      state: 'Discard',
      comment: 'Synthetic finding, reviewed.',
    });
    expect(response.structuredContent).toMatchObject({
      verified: true,
      effects: 'applied',
      state: 'Discard',
      comment_readback: 'branch_history',
    });
    expect(f.server.issue.approvalState).toBe('Discard');
    expect(f.telemetry.action).toHaveBeenCalledWith('aie_triage_issue', 'applied', '6.4.0.1234');
  });
  it('preserves applied triage effects when history readback is unavailable', async () => {
    const f = await fixture();
    f.server.faults.set(`GET /api/history/branches/${ids.branch}`, { status: 403 });
    const response = await f.call('aie_triage_issue', { ...selected, state: 'Approval', comment: 'Reviewed.' });
    expect(response).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'AIE_READBACK_UNAVAILABLE', effects: 'applied' } },
    });
    expect(f.server.issue.approvalState).toBe('Approval');
  });
  it('rejects mismatching parent IDs before any triage write', async () => {
    const f = await fixture();
    const findings = new Findings(f.server.api());
    await expect(findings.branch('other-project', ids.branch)).rejects.toMatchObject({ code: 'AIE_TARGET_MISMATCH' });
    await expect(findings.scan(ids.project, ids.scan, 'other-branch')).rejects.toMatchObject({
      code: 'AIE_TARGET_MISMATCH',
    });
    f.server.issue.scanResultId = 'other-scan';
    await expect(findings.details(ids.project, ids.scan, ids.issue)).rejects.toMatchObject({
      code: 'AIE_TARGET_MISMATCH',
    });
    expect(f.server.calls.filter((call) => call.method !== 'GET')).toHaveLength(0);
  });
  it('keeps readiness/validation errors in the tool envelope without saving commands', async () => {
    const f = await fixture();
    expect(await f.call('aie_update_project_settings', { ...project, changes: {} })).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'AIE_VALIDATION_ERROR' } },
    });
    await f.storage.clear();
    expect(await f.call('aie_start_scan', branch)).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'AIE_LOGIN_REQUIRED' } },
    });
    expect(f.server.calls.some((call) => call.method === 'POST')).toBe(false);
  });
});

describe('settings write DTOs, preservation and readback', () => {
  it('refuses a hidden RawCookie before writing and permits an explicit replacement or auth disable', async () => {
    const f = await fixture();
    f.server.maskBlackboxCredentials = true;
    f.server.settings.blackBoxSettings.authentication = {
      type: 'RawCookie',
      cookie: { cookie: 'session=fixture-secret' },
    };
    const refused = await f.call('aie_update_project_settings', {
      ...project,
      section: 'blackbox',
      changes: { sslCheck: false },
    });
    expect(refused).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'AIE_CREDENTIALS_PRESERVATION_REQUIRED', effects: 'not_applied' } },
    });
    expect(f.server.calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
    expect(f.server.settings.blackBoxSettings.authentication).toMatchObject({
      cookie: { cookie: 'session=fixture-secret' },
    });
    const replaced = await f.call('aie_update_project_settings', {
      ...project,
      section: 'blackbox',
      changes: { authentication: { cookie: { cookie: 'session=replacement' } }, sslCheck: false },
    });
    expect(replaced.structuredContent).toMatchObject({
      effects: 'applied',
      verified: false,
      verification: { unverified_fields: ['authentication.cookie.cookie'] },
    });
    expect(f.server.settings.blackBoxSettings.authentication).toMatchObject({
      cookie: { cookie: 'session=replacement' },
    });
    const disabled = await f.call('aie_update_project_settings', {
      ...project,
      section: 'blackbox',
      changes: { authentication: { type: 'None' }, sslCheck: true },
    });
    expect(disabled.structuredContent).toMatchObject({ verified: true });
  });
  it('retains a readable RawCookie when the server exposes its value', async () => {
    const f = await fixture();
    f.server.settings.blackBoxSettings.authentication = {
      type: 'RawCookie',
      cookie: { cookie: 'session=visible-fixture' },
    };
    const saved = await f.call('aie_update_project_settings', {
      ...project,
      section: 'blackbox',
      changes: { sslCheck: false },
    });
    expect(saved.structuredContent).toMatchObject({ verified: true });
    expect(f.server.settings.blackBoxSettings.authentication).toMatchObject({
      cookie: { cookie: 'session=visible-fixture' },
    });
  });
  it('reports an explicitly empty proxy password as preservation rather than claiming it was erased', async () => {
    const f = await fixture();
    f.server.maskBlackboxCredentials = true;
    f.server.settings.blackBoxSettings.proxySettings = { isActive: true, type: 'Http', password: 'proxy-secret' };
    const saved = await f.call('aie_update_project_settings', {
      ...project,
      section: 'blackbox',
      changes: { proxySettings: { password: '' } },
    });
    expect(saved.structuredContent).toMatchObject({
      verified: true,
      verification: { preserved_fields: ['proxySettings.password'] },
    });
    expect(f.server.settings.blackBoxSettings.proxySettings).toMatchObject({ password: 'proxy-secret' });
  });
  it('preserves all hidden BlackBox credential leaves when changing adjacent settings', async () => {
    const f = await fixture();
    f.server.maskBlackboxCredentials = true;
    const original = {
      isActive: false,
      sslCheck: true,
      authentication: {
        type: 'Http',
        http: { login: 'fixture', password: 'http-secret' },
        form: { password: 'form-secret' },
      },
      proxySettings: { isActive: false, type: 'Http', password: 'proxy-secret' },
    };
    f.server.settings.blackBoxSettings = original;
    const saved = await f.call('aie_update_project_settings', {
      ...project,
      section: 'blackbox',
      changes: { sslCheck: false },
    });
    expect(saved).toMatchObject({
      structuredContent: { verified: true, verification: { secret_values_verified: true } },
    });
    expect(f.server.settings.blackBoxSettings).toMatchObject({ ...original, sslCheck: false });
    const write = f.server.calls.find((call) => call.method === 'PUT' && call.path.endsWith('/blackBoxSettings'))!;
    for (const field of ['authentication.http.password', 'authentication.form.password', 'proxySettings.password']) {
      expect(write.body).not.toHaveProperty(field);
    }
  });
  it('reports hidden replacement credentials as accepted with explicit verification limits', async () => {
    const f = await fixture();
    f.server.maskBlackboxCredentials = true;
    f.server.settings.blackBoxSettings.authentication = { type: 'Http', http: { login: 'fixture', password: 'old' } };
    const saved = await f.call('aie_update_project_settings', {
      ...project,
      section: 'blackbox',
      changes: { authentication: { http: { password: 'new' } }, proxySettings: { password: 'proxy-new' } },
    });
    expect(saved.isError).not.toBe(true);
    expect(saved.structuredContent).toMatchObject({
      effects: 'applied',
      verified: false,
      verification: {
        secret_values_verified: false,
        unverified_fields: ['authentication.http.password', 'proxySettings.password'],
      },
    });
    expect(f.server.settings.blackBoxSettings.authentication).toMatchObject({ http: { password: 'new' } });
    expect(f.telemetry.action).toHaveBeenCalledWith('aie_update_project_settings', 'accepted', '6.4.0.1234');
    expect(JSON.stringify(saved)).not.toContain('proxy-new');
  });
  it('allows an explicitly empty credential to clear while null preserves the prior value', async () => {
    const f = await fixture();
    f.server.maskBlackboxCredentials = true;
    f.server.settings.blackBoxSettings.authentication = { type: 'Http', http: { password: 'keep' } };
    const service = new Settings(f.server.api());
    expect(
      await service.update(ids.project, 'blackbox', { authentication: { http: { password: null } } }),
    ).toMatchObject({ verified: true, verification: { preserved_fields: ['authentication.http.password'] } });
    expect(f.server.settings.blackBoxSettings.authentication).toMatchObject({ http: { password: 'keep' } });
    expect(await service.update(ids.project, 'blackbox', { authentication: { http: { password: '' } } })).toMatchObject(
      { verified: true },
    );
    expect(f.server.settings.blackBoxSettings.authentication).toMatchObject({ http: { password: '' } });
  });
  it('updates all five sections, preserves adjacent values and newer nested fields', async () => {
    const f = await fixture();
    const cases = [
      ['scan', { whiteBoxSettings: { patternMatchingEnabled: false } }],
      ['pm_groups', { applyAllPmRules: true }],
      [
        'policies',
        { checkSecurityPoliciesAccordance: true, securityPolicies: '[{ /* comment */ "CountToActualize":2,}]' },
      ],
      ['blackbox', { isActive: true }],
      ['preferred_agents', { preferredAgentsOnly: true }],
    ] as const;
    for (const [section, changes] of cases) {
      const read = await f.call('aie_get_project_settings', { ...project, section, include_template: true });
      const response = await f.call('aie_update_project_settings', {
        ...project,
        section,
        changes,
        base_revision: read.structuredContent!.revision,
      });
      expect(response.isError, section).not.toBe(true);
      expect(response.structuredContent?.verified).toBe(true);
    }
    expect(f.server.settings.settings.whiteBoxSettings).toEqual({
      patternMatchingEnabled: false,
      staticCodeAnalysisEnabled: false,
      asintEnabled: true,
    });
    expect(f.server.settings.preferredAgentsSettings.preferredAgents).toEqual([ids.agent]);
    const write = f.server.calls.find((call) => call.path.endsWith('/settings') && call.method === 'PUT')!;
    expect(write.body).not.toHaveProperty('sourceType');
  });
  it('reads historical scan configuration and labels other sections as current', async () => {
    const f = await fixture();
    const service = new Settings(f.server.api());
    expect(await service.get(ids.project, 'scan', ids.scan)).toMatchObject({
      settings_source: 'historical_scan',
      values: { id: ids.settings },
    });
    expect(await service.get(ids.project, 'pm_groups', ids.scan)).toMatchObject({ settings_source: 'current_project' });
    f.server.scans.get(ids.scan)!.settingsId = undefined;
    await expect(service.get(ids.project, 'scan', ids.scan)).rejects.toMatchObject({ code: 'AIE_NOT_FOUND' });
  });
  it('rejects a mismatching historical scan parent before reading its settings', async () => {
    const f = await fixture();
    f.server.scans.get(ids.scan)!.projectId = 'another-project';
    await expect(new Settings(f.server.api()).get(ids.project, 'scan', ids.scan)).rejects.toMatchObject({
      code: 'AIE_TARGET_MISMATCH',
    });
    expect(f.server.calls.some((call) => call.path.includes('/scanSettings/'))).toBe(false);
  });
  it('refuses stale revisions, null/unknown changes, empty policy and masked credential roundtrips', async () => {
    const f = await fixture();
    const settings = new Settings(f.server.api());
    await expect(settings.update(ids.project, 'scan', { skipGitIgnoreFiles: true }, 'old')).rejects.toMatchObject({
      code: 'AIE_REVISION_CONFLICT',
    });
    await expect(settings.update(ids.project, 'scan', { invented: true })).rejects.toMatchObject({
      code: 'AIE_VALIDATION_ERROR',
    });
    await expect(settings.update(ids.project, 'policies', { securityPolicies: null })).rejects.toMatchObject({
      code: 'AIE_VALIDATION_ERROR',
    });
    f.server.settings.blackBoxSettings.proxySettings = { isActive: true, password: '********' };
    await expect(
      settings.update(ids.project, 'blackbox', { isActive: true, proxySettings: { password: '********' } }),
    ).rejects.toMatchObject({
      code: 'AIE_CREDENTIALS_PRESERVATION_REQUIRED',
    });
    expect(f.server.calls.some((call) => call.method === 'PUT')).toBe(false);
  });
  it('distinguishes accepted write with failed readback from a write refusal', async () => {
    const f = await fixture();
    f.server.onWrite = (pathname) => {
      if (pathname.endsWith('/settings')) {
        f.server.faults.set(`GET ${pathname}`, { status: 403 });
      }
    };
    const response = await f.call('aie_update_project_settings', {
      ...project,
      section: 'scan',
      changes: { skipGitIgnoreFiles: true },
    });
    expect(response).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'AIE_READBACK_UNAVAILABLE', effects: 'applied' } },
    });
    expect(f.server.settings.settings.skipGitIgnoreFiles).toBe(true);
  });
});

describe('shared PM catalog CRUD semantics', () => {
  it('creates type/rule/group and renames a group without losing its rule set', async () => {
    const f = await fixture();
    const service = new PmCatalog(f.server.api());
    const type = await service.save('types', 'create', undefined, { name: 'new type' });
    expect(type.verified).toBe(true);
    const rule = await service.save('rules', 'create', undefined, {
      name: 'new rule',
      value: 'marker',
      dataFormat: 'Regex',
      level: 'Low',
      vulnerabilityTypeId: type.id,
      pmGroupIds: [],
    });
    expect(rule.id).toMatch(/^custom-rule-/);
    expect(rule.verified).toBe(true);
    const group = await service.save('groups', 'create', undefined, { name: 'new group', rules: [rule.id] });
    const read = await service.entry('groups', group.id!);
    const updated = await service.save('groups', 'update', group.id!, undefined, { name: 'renamed' }, read.revision);
    expect(updated.values).toMatchObject({ name: 'renamed', rules: [rule.id] });
    const changedRule = await service.save('rules', 'update', rule.id!, undefined, { description: 'updated' });
    expect(changedRule.values).toMatchObject({ description: 'updated', value: 'marker' });
  });
  it('reports ambiguous create IDs without repeating the accepted POST', async () => {
    const f = await fixture();
    f.server.ambiguousCreate = true;
    const response = await new PmCatalog(f.server.api()).save('rules', 'create', undefined, { name: 'ambiguous' });
    expect(response).toMatchObject({ effects: 'applied', id: null, id_resolution: 'ambiguous' });
    expect(f.server.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  });
  it('requires explicit action/id and rejects unsupported type updates and revision conflicts', async () => {
    const f = await fixture();
    const service = new PmCatalog(f.server.api());
    await expect(service.save('rules', 'update', undefined, undefined, { name: 'bad' })).rejects.toMatchObject({
      code: 'AIE_VALIDATION_ERROR',
    });
    await expect(service.save('types', 'update', ids.type, undefined, { name: 'bad' })).rejects.toMatchObject({
      code: 'AIE_VALIDATION_ERROR',
    });
    await expect(
      service.save('groups', 'update', ids.group, undefined, { name: 'bad' }, revision({ old: true })),
    ).rejects.toMatchObject({ code: 'AIE_REVISION_CONFLICT' });
  });
});

describe('selected scan lifecycle and diagnostics', () => {
  it('keeps Failed a successful status read, returns diagnostics and deduplicates terminal telemetry', async () => {
    const f = await fixture();
    f.server.scans.get(ids.scan)!.progress = { stage: 'Failed', value: 12 };
    for (let index = 0; index < 2; index++) {
      const response = await f.call('aie_get_operation', { ...branch, scan_id: ids.scan });
      expect(response.isError).not.toBe(true);
      expect(response.structuredContent).toMatchObject({ state: 'failed', diagnostics: { available: true, total: 1 } });
    }
    expect(vi.mocked(f.telemetry.action).mock.calls.filter((call) => call[0] === 'scan_terminal')).toHaveLength(1);
  });
  it('maps queued, exact running, terminal and unknown states without substituting latest scan', async () => {
    const f = await fixture();
    const runs = new Map();
    const service = new Scans(f.server.api(), runs);
    expect(await service.status(ids.project, ids.branch, ids.queue)).toMatchObject({ state: 'queued', scan_id: null });
    f.server.queueMode = 'running';
    f.server.queueScanId = ids.scan;
    f.server.scans.get(ids.scan)!.progress = { stage: 'Scan', value: 20 };
    expect(await service.status(ids.project, ids.branch, ids.queue)).toMatchObject({
      state: 'running',
      scan_id: ids.scan,
      correlation: 'queue',
    });
    f.server.scans.get(ids.scan)!.progress = { stage: 'FutureStage', value: 20 };
    expect(await service.status(ids.project, ids.branch, undefined, ids.scan)).toMatchObject({ state: 'unknown' });
    await expect(service.status(ids.project, ids.branch, ids.queue, ids.scan)).rejects.toMatchObject({
      code: 'AIE_VALIDATION_ERROR',
    });
  });
  it('distinguishes queued removal and running stop from confirmed terminal state', async () => {
    const f = await fixture();
    const service = new Scans(f.server.api(), new Map());
    expect(await service.stop(ids.project, ids.branch, ids.queue)).toMatchObject({
      stop_requested: true,
      stop_confirmed: false,
    });
    f.server.scans.get(ids.scan)!.progress = { stage: 'Scan', value: 50 };
    expect(await service.stop(ids.project, ids.branch, undefined, ids.scan)).toMatchObject({
      stop_requested: true,
      stop_confirmed: false,
    });
    expect(await service.stop(ids.project, ids.branch, undefined, ids.scan)).toMatchObject({
      stop_requested: false,
      stop_confirmed: true,
    });
    expect(f.server.calls.some((call) => call.method === 'DELETE')).toBe(true);
    expect(f.server.calls.some((call) => call.path.endsWith('/stop') && call.method === 'POST')).toBe(true);
  });
  it('retains known progress when optional diagnostics fail', async () => {
    const f = await fixture();
    const service = new Scans(f.server.api(), new Map());
    f.server.faults.set(`GET /api/projects/${ids.project}/scanResults/${ids.scan}/errors`, { status: 403 });
    expect(await service.diagnostics('identity', ids.project, ids.scan, new Pages(), {})).toMatchObject({
      available: false,
      error: { code: 'AIE_PERMISSION_DENIED' },
    });
    expect(await service.status(ids.project, ids.branch, undefined, ids.scan)).toMatchObject({ state: 'done' });
  });
});

describe('background source workflows and control calls', () => {
  it('creates/uploads/downloads and starts scans through quick operation IDs with retained terminal results', async () => {
    const f = await fixture();
    const source = path.join(f.root, 'source');
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, 'main.js'), 'synthetic source');
    for (const [name, args] of [
      [
        'aie_create',
        {
          kind: 'project',
          source_directory: source,
          name: 'fixture',
          branch_name: 'main',
          scan_changes: { skipGitIgnoreFiles: true },
        },
      ],
      ['aie_upload_sources', { ...branch, source_directory: source }],
      ['aie_download_project', { ...branch, scan_id: ids.scan, destination: path.join(f.root, 'downloaded') }],
      ['aie_start_scan', { ...branch, scope: 'Incremental', label_suffix: 'fixture' }],
    ] as Array<[string, Record<string, unknown>]>) {
      const response = await f.call(name, args);
      expect(response.isError, name).not.toBe(true);
      const job = await terminal(f.dispatcher, String(response.structuredContent!.operation_id));
      expect(job, name).toMatchObject({ state: 'succeeded', effects: 'applied' });
      expect((await f.call('aie_get_operation', { operation_id: job.operation_id })).structuredContent).toMatchObject({
        state: job.state,
        result: job.result,
        known_ids: job.known_ids,
      });
    }
    expect(await fs.readFile(path.join(f.root, 'downloaded', 'sources', 'main.js'), 'utf8')).toBe('synthetic source');
    expect(vi.mocked(f.telemetry.action).mock.calls.filter((call) => call[0] === 'aie_start_scan')).toHaveLength(1);
  });
  it('allows cancelling an active create instead of blocking its control call as target-busy', async () => {
    const f = await fixture();
    const identity = (await f.sessions.require()).identity;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const job = f.dispatcher.operations.start(identity, 'aie_create', 'create-project', async (context) => {
      await pending;
      context.check();
      return {};
    });
    const response = await f.call('aie_cancel_operation', { operation_id: job.operation_id });
    expect(response).toMatchObject({ structuredContent: { state: 'cancelling' } });
    release();
    expect(await terminal(f.dispatcher, job.operation_id)).toMatchObject({ state: 'cancelled' });
  });
  it('returns inferred scan IDs after fast assignment and preserves source readiness errors', async () => {
    const f = await fixture();
    f.server.queueMode = 'assigned';
    const started = await f.call('aie_start_scan', branch);
    const job = await terminal(f.dispatcher, String(started.structuredContent!.operation_id));
    expect(job.state).toBe('succeeded');
    expect((await f.call('aie_get_operation', { operation_id: job.operation_id })).structuredContent).toMatchObject({
      remote: { correlation: 'branch_history', scan_id: f.server.queueScanId, state: 'running' },
    });
    f.server.sourceDate = '0001-01-01T00:00:00Z';
    const refused = await f.call('aie_start_scan', branch);
    expect(refused).toMatchObject({ isError: true, structuredContent: { error: { code: 'AIE_SOURCES_NOT_READY' } } });
  });
});
