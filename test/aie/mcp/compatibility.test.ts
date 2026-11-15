import { describe, expect, it } from 'vitest';
import { httpError } from '../../../src/aie/api/http-errors.js';
import { validateWrite, writable, writeSchema } from '../../../src/aie/api/write-schema.js';
import { parseToolCall } from '../../../src/aie/mcp/validation.js';
import { Findings } from '../../../src/aie/projects/findings.js';
import { Settings } from '../../../src/aie/settings/project-settings.js';
import { verifyScanReadback } from '../../../src/aie/settings/scan-contract.js';
import { AieFixture, ids } from '../../fixtures/aie-server.js';

const recordScan = 'bbbbbbbb-bbbb-bbbb-bbbb-000000000001';
const scanModel = 'ProjectSettingsUpdateModel';
const settingsPath = `/api/projects/${ids.project}/settings`;
const issuesPath = `/api/projects/${ids.project}/scanResults/${ids.scan}/issues`;

function fixture(version = '6.4.0') {
  const server = new AieFixture();
  const api = server.api();
  api.serverVersion = version;
  return { server, api, settings: new Settings(api), findings: new Findings(api) };
}

function incremental(version?: string) {
  const result = fixture(version);
  result.server.scans.set(recordScan, { id: recordScan, projectId: ids.project, branchId: ids.branch });
  result.server.issue.scanResultId = recordScan;
  result.server.issue.scanModule = 'RaceConditionDetection';
  result.server.issue.isSuppressed = false;
  // Same shape as the real 6.4 full-issue response; distinct paths cannot be flattened to one dataflow.
  const chunk = (line: number, value: string) => ({
    item: { file: './Race/main.py', beginLine: line, endLine: line, beginColumn: 1, endColumn: 20, value },
    label: 'Function',
  });
  result.server.issue.vulnerableCode = {
    entryPoint: null,
    dataTrace: null,
    raceCondition: {
      type: 'Toctou',
      groupId: null,
      sharedData: chunk(117, 'self.messages'),
      firstPath: {
        entryPoint: chunk(144, 'dequeue'),
        path: [chunk(145, 'mq.dequeue()')],
        dataAccess: chunk(125, 'pop'),
      },
      secondPath: {
        entryPoint: chunk(154, 'purge'),
        path: [chunk(155, 'mq.purge()')],
        dataAccess: chunk(134, 'clear'),
      },
      futureEvidence: { label: 'NewLabel', value: null },
    },
  };
  return result;
}

describe('versioned write contracts', () => {
  it.each(['6.3.0', '6.4.0'])(
    'verifies reordered language flags on %s without altering the saved order',
    async (version) => {
      const f = fixture(version);
      const request = f.server.request;
      f.server.request = async (url, init) => {
        const response = await request(url, init);
        if (init?.method === 'PUT' && String(url).endsWith('/settings')) {
          f.server.settings.settings.languages = ['JavaScript', 'Python'];
        }
        return response;
      };
      const api = f.server.api();
      api.serverVersion = version;
      const result = await new Settings(api).update(ids.project, 'scan', { languages: ['Python', 'JavaScript'] });
      expect(result).toMatchObject({ verified: true, values: { languages: ['JavaScript', 'Python'] } });
    },
  );

  it('treats languages as a set but still rejects missing/extra languages and other reordered arrays', () => {
    const changes = { languages: ['Python', 'JavaScript', 'Python'], reportAfterScan: { emailRecipients: ['a', 'b'] } };
    const original = structuredClone(changes);
    expect(() =>
      verifyScanReadback(
        { languages: ['JavaScript', 'Python'], reportAfterScan: { emailRecipients: ['a', 'b'] } },
        changes,
      ),
    ).not.toThrow();
    for (const saved of [
      null,
      [],
      { languages: ['Python'] },
      { languages: ['JavaScript', 'Python', 'Go'] },
      { languages: null },
      { languages: ['JavaScript', 'Python'], reportAfterScan: { emailRecipients: ['b', 'a'] } },
    ]) {
      expect(() => verifyScanReadback(saved, changes)).toThrow(
        expect.objectContaining({
          code: 'AIE_READBACK_MISMATCH',
          details: { effects: 'applied', next_action: expect.any(String) },
        }),
      );
    }
    expect(changes).toEqual(original);
  });

  it('exposes the 6.4 race schema and sends the whole preserved settings document', async () => {
    const f = fixture();
    f.server.settings.settings.raceConditionSettings = { launchParameters: '--fixture' };
    f.server.settings.settings.whiteBoxSettings = {
      patternMatchingEnabled: true,
      searchForRaceConditionsEnabled: true,
      asintEnabled: false,
    };
    const read = await f.settings.get(ids.project, 'scan');
    expect(read.write_schema.$defs).toHaveProperty('RaceConditionSettingsModel');
    const result = await f.settings.update(ids.project, 'scan', { skipGitIgnoreFiles: true });
    expect(result.verified).toBe(true);
    const body = f.server.calls.find((call) => call.path === settingsPath && call.method === 'PUT')!.body;
    expect(body).toMatchObject({
      raceConditionSettings: { launchParameters: '--fixture' },
      whiteBoxSettings: { searchForRaceConditionsEnabled: true, patternMatchingEnabled: true, asintEnabled: false },
    });
    expect(body).not.toHaveProperty('sourceType');
    expect(body).not.toHaveProperty('langPercentDistribution');
    await f.settings.update(ids.project, 'scan', {
      whiteBoxSettings: { searchForRaceConditionsEnabled: false },
      raceConditionSettings: { launchParameters: null },
    });
    expect(f.server.settings.settings).toMatchObject({
      whiteBoxSettings: { searchForRaceConditionsEnabled: false, patternMatchingEnabled: true, asintEnabled: false },
      raceConditionSettings: { launchParameters: null },
    });
  });

  it.each(['6.3.0', undefined])('rejects 6.4 writes on %s before PUT, independently of validator cache', (version) => {
    const change = { whiteBoxSettings: { searchForRaceConditionsEnabled: true } };
    validateWrite(scanModel, change, '6.4.0');
    expect(() => validateWrite(scanModel, change, version)).toThrow();
    expect(writeSchema(scanModel, version).$defs).not.toHaveProperty('RaceConditionSettingsModel');
    expect(writable(scanModel, { raceConditionSettings: { launchParameters: '' } }, version)).toEqual({});
  });

  it('rejects invalid/null and unknown race settings but permits nullable launchParameters', async () => {
    const f = fixture();
    for (const changes of [
      { whiteBoxSettings: { searchForRaceConditionsEnabled: null } },
      { whiteBoxSettings: { searchForRaceConditionsEnabled: 'true' } },
      { raceConditionSettings: null },
      { raceConditionSettings: { unexpected: true } },
    ]) {
      await expect(f.settings.update(ids.project, 'scan', changes)).rejects.toMatchObject({
        code: 'AIE_VALIDATION_ERROR',
      });
    }
    expect(f.server.calls.some((call) => call.method === 'PUT')).toBe(false);
    validateWrite(scanModel, { raceConditionSettings: { launchParameters: null } }, f.api.serverVersion);
    expect(f.api.scoped(new AbortController().signal).serverVersion).toBe(f.api.serverVersion);
  });

  it.each(['6.3.0', '6.4.0'])('preserves observed Asint settings on %s', async (version) => {
    const f = fixture(version);
    f.server.settings.settings.asintSettings = { useNaira: true };
    f.server.settings.settings.whiteBoxSettings = {
      ...(version.startsWith('6.4.') ? { searchForRaceConditionsEnabled: false } : {}),
      asintEnabled: false,
    };
    const read = await f.settings.get(ids.project, 'scan');
    const definitions = read.write_schema.$defs as Record<string, { properties: Record<string, unknown> }>;
    expect(definitions.ProjectSettingsUpdateModel.properties).not.toHaveProperty('raceConditionSettings');
    expect(definitions.ProjectSettingsUpdateModel.properties).toHaveProperty('asintSettings');
    await expect(
      f.settings.update(ids.project, 'scan', { raceConditionSettings: { launchParameters: '--test' } }),
    ).rejects.toMatchObject({ code: 'AIE_VALIDATION_ERROR' });
    await f.settings.update(ids.project, 'scan', { skipGitIgnoreFiles: true });
    expect(f.server.calls.find((call) => call.method === 'PUT')!.body).toMatchObject({
      asintSettings: { useNaira: true },
    });
    expect(f.server.settings.settings.whiteBoxSettings).toHaveProperty('asintEnabled', false);
  });

  it('uses current capabilities for historical settings without replacing their historical values', async () => {
    const f = fixture();
    f.server.settings.settings.whiteBoxSettings = { searchForRaceConditionsEnabled: true, asintEnabled: false };
    f.server.settings.settings.asintSettings = { useNaira: true };
    const historic = await f.settings.get(ids.project, 'scan', ids.scan);
    const definitions = historic.write_schema.$defs as Record<string, { properties: Record<string, unknown> }>;
    expect(historic).toMatchObject({ settings_source: 'historical_scan', write_schema_source: 'current_project' });
    expect(historic.values).not.toHaveProperty('whiteBoxSettings');
    expect(definitions.WhiteBoxSettingsModel.properties).toHaveProperty('searchForRaceConditionsEnabled');
    expect(definitions.ProjectSettingsUpdateModel.properties).toHaveProperty('asintSettings');
  });

  it('retains the new server error code and an actionable reason without upstream messages', async () => {
    const error = await httpError(
      new Response(
        JSON.stringify({
          errorCode: 'INVALID_LANGUAGE_FOR_RACE_CONDITION',
          message: 'must never echo this',
        }),
        { status: 400 },
      ),
      true,
    );
    expect(error.details).toMatchObject({ server_code: 'INVALID_LANGUAGE_FOR_RACE_CONDITION', effects: 'not_applied' });
    expect(error.details.next_action).toContain('languages');
    expect(JSON.stringify(error)).not.toContain('must never echo this');
  });

  it('retains the deployed Asint integration refusal', async () => {
    const error = await httpError(
      new Response(JSON.stringify({ errorCode: 'ASINT_NAIRA_INTEGRATION_DISABLED' }), { status: 400 }),
      true,
    );
    expect(error.details).toMatchObject({ server_code: 'ASINT_NAIRA_INTEGRATION_DISABLED', effects: 'not_applied' });
    expect(error.details.next_action).toContain('administrator');
  });

  it('refuses to silently drop a future top-level settings section', async () => {
    const f = fixture();
    f.server.settings.settings.futureModuleSettings = { enabled: true };
    await expect(f.settings.update(ids.project, 'scan', { skipGitIgnoreFiles: true })).rejects.toMatchObject({
      code: 'AIE_SCHEMA_MISSING',
      details: { effects: 'not_applied' },
    });
    expect(f.server.calls.some((call) => call.method === 'PUT')).toBe(false);
  });
});

describe('incremental findings and complete evidence', () => {
  it.each(['6.3.0', '6.4.0'])('checks incremental membership on %s without losing raw evidence', async (version) => {
    const f = incremental(version);
    const result = await f.findings.details(ids.project, ids.scan, ids.issue, ids.branch);
    expect(result).toMatchObject({
      scan_id: ids.scan,
      issue_record_scan_id: recordScan,
      evidence_reused: true,
      source_revision: 'not_proven_by_issue_response',
      issue: { scanResultId: recordScan, vulnerableCode: f.server.issue.vulnerableCode },
    });
    expect(f.server.calls.some((call) => call.path === issuesPath)).toBe(true);
    expect(f.server.calls.some((call) => call.path.endsWith('/fullInfo'))).toBe(false);
    expect(
      await f.findings.triage(ids.project, ids.scan, ids.issue, 'None', 'Reviewed both paths.', ids.branch),
    ).toMatchObject({ verified: true, comment_readback: 'branch_history' });
  });

  it('rejects an issue absent from the selected scan and never writes triage', async () => {
    const f = incremental();
    f.server.issues = [];
    await expect(
      f.findings.triage(ids.project, ids.scan, ids.issue, 'Discard', 'test', ids.branch),
    ).rejects.toMatchObject({ code: 'AIE_TARGET_MISMATCH', details: { effects: 'not_applied' } });
    expect(f.server.calls.some((call) => call.method !== 'GET')).toBe(false);
  });

  it.each([403, 500])('does not allow a membership HTTP %s to broaden the scope', async (status) => {
    const f = incremental();
    f.server.faults.set(`GET ${issuesPath}`, { status });
    await expect(f.findings.details(ids.project, ids.scan, ids.issue)).rejects.toMatchObject({
      details: { http_status: status },
    });
    expect(f.server.calls.some((call) => call.path.endsWith('/fullInfo'))).toBe(false);
  });

  it('rejects a record from another branch even when returned by the selected issue list', async () => {
    const f = incremental();
    f.server.scans.get(recordScan)!.branchId = ids.group;
    await expect(f.findings.details(ids.project, ids.scan, ids.issue)).rejects.toMatchObject({
      code: 'AIE_TARGET_MISMATCH',
    });
  });

  it.each([
    'Weakness',
    'Configuration',
    'Fingerprint',
    'BlackBox',
    'Pygrep',
    'Sca',
    'FingerprintSca',
    'Secret',
    'MaliciousCode',
    'FutureCategory',
  ])('preserves the %s payload without assuming SAST dataflow', async (issueType) => {
    const f = fixture();
    f.server.issue.issueType = issueType;
    f.server.issue.unrecognizedEvidence = { wireEnum: 'NewValue', nested: [null, { binary: false }] };
    const result = await f.findings.details(ids.project, ids.scan, ids.issue);
    expect(result.issue).toEqual(f.server.issue);
  });

  it('filters suppression and summarizes category/module separately from vulnerability type', async () => {
    const f = incremental();
    f.server.issue.type = 'Toctou';
    f.server.issues = [f.server.issue, { ...f.server.issue, id: ids.group, isSuppressed: true }];
    parseToolCall('aie_list_issues', { project_id: ids.project, scan_id: ids.scan, is_suppressed: false });
    const result = await f.findings.query(
      ids.project,
      ids.scan,
      { scan_module: ['RaceConditionDetection'], is_suppressed: false },
      ids.branch,
      'summary',
    );
    expect(result.metadata.matched_issues).toBe(1);
    expect(result.items).toEqual(
      expect.arrayContaining([
        { group: 'type', value: 'Toctou', count: 1 },
        { group: 'scan_module', value: 'RaceConditionDetection', count: 1 },
        { group: 'issue_type', value: 'Vulnerability', count: 1 },
        { group: 'is_suppressed', value: 'false', count: 1 },
      ]),
    );
  });
});
