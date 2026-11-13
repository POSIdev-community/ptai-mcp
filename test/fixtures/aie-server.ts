import yazl from 'yazl';
import { AieApi } from '../../src/aie/api/client.js';

export const ids = {
  project: '11111111-1111-1111-1111-111111111111',
  branch: '22222222-2222-2222-2222-222222222222',
  scan: '33333333-3333-3333-3333-333333333333',
  issue: '44444444-4444-4444-4444-444444444444',
  group: '55555555-5555-5555-5555-555555555555',
  type: '66666666-6666-6666-6666-666666666666',
  agent: '77777777-7777-7777-7777-777777777777',
  queue: '88888888-8888-8888-8888-888888888888',
  settings: '99999999-9999-9999-9999-999999999999',
  user: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
};
type JsonObject = Record<string, unknown>;
const data = (value: unknown) => value as JsonObject;
const json = (value: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const empty = () => json(null, 204);

function archive() {
  const zip = new yazl.ZipFile();
  const result = new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Buffer[] = [];
    zip.outputStream.on('data', (chunk) => chunks.push(chunk));
    zip.outputStream.on('error', reject);
    zip.outputStream.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
  });
  zip.addBuffer(Buffer.from('synthetic source'), 'main.js');
  zip.end();
  return result;
}

function preserveFixtureSecrets(prior: JsonObject, nextSettings: JsonObject): void {
  // Independent fixture for the observed API contract: absent/null
  // secret leaves preserve, while an explicit empty string clears.
  for (const path of [
    ['authentication', 'http', 'password'],
    ['authentication', 'form', 'password'],
    ['authentication', 'cookie', 'cookie'],
    ['proxySettings', 'password'],
  ]) {
    const key = path.pop()!;
    const previous = path.reduce<unknown>(
      (node, part) => (node && typeof node === 'object' ? data(node)[part] : undefined),
      prior,
    );
    const next = path.reduce<unknown>(
      (node, part) => (node && typeof node === 'object' ? data(node)[part] : undefined),
      nextSettings,
    );
    if (
      next &&
      typeof next === 'object' &&
      path[1] !== 'cookie' &&
      (data(next)[key] == null || (path[0] === 'proxySettings' && data(next)[key] === '')) &&
      previous &&
      typeof previous === 'object'
    ) {
      data(next)[key] = data(previous)[key];
    }
  }
}

/** Small independent HTTP contract fixture. Production services use the actual
 * generated client against these routes; no domain methods are mocked out. */
export class AieFixture {

  public readonly calls: Array<{ method: string; path: string; body: unknown; authorization: string | null }> = [];
  public readonly faults = new Map<string, { status: number; body?: unknown }>();
  public readonly settings: Record<string, JsonObject> = {
    settings: {
      projectName: 'fixture',
      sourceType: 'Local',
      languages: ['JavaScript'],
      skipGitIgnoreFiles: false,
      whiteBoxSettings: { patternMatchingEnabled: true, staticCodeAnalysisEnabled: false, asintEnabled: true },
    },
    analysisRules: { applyAllPmRules: false, pmGroupIds: [ids.group] },
    securityPolicies: { checkSecurityPoliciesAccordance: false, securityPolicies: '[{"CountToActualize":1}]' },
    blackBoxSettings: {
      isActive: false,
      site: 'https://fixture.invalid',
      proxySettings: { isActive: false, password: null },
    },
    preferredAgentsSettings: { preferredAgents: [ids.agent], preferredAgentsOnly: false },
  };
  public readonly rules = new Map<string, JsonObject>([
    [
      'custom-rule',
      {
        id: 'custom-rule',
        name: 'existing',
        description: 'keep',
        pmGroupIds: [ids.group],
        vulnerabilityType: { id: ids.type },
        value: 'marker',
        dataFormat: 'Regex',
        level: 'Low',
      },
    ],
  ]);
  public readonly groups = new Map<string, JsonObject>([
    [ids.group, { id: ids.group, name: 'group', rules: ['custom-rule'] }],
  ]);
  public readonly types = new Map<string, JsonObject>([[ids.type, { id: ids.type, name: 'fixture finding' }]]);
  public readonly scans = new Map<string, JsonObject>([
    [
      ids.scan,
      {
        id: ids.scan,
        projectId: ids.project,
        branchId: ids.branch,
        settingsId: ids.settings,
        progress: { stage: 'Done', value: 100 },
        statistic: { high: 1 },
        hasErrors: false,
        scanType: 'Full',
      },
    ],
  ]);
  public readonly issue: JsonObject = {
    id: ids.issue,
    scanResultId: ids.scan,
    counter: 42,
    type: 'fixture finding',
    level: 'High',
    issueType: 'Vulnerability',
    approvalState: 'None',
    isNew: false,
    sourceFile: 'src/main.js',
    sourceBeginLine: 7,
    vulnerableCode: { sourceFile: 'src/main.js', dataFlow: [] },
  };
  public sourceDate = '2026-11-10T12:00:00Z';
  public hasSources = true;
  public issues?: JsonObject[];
  public readonly titles = new Map<string, string>();
  public queueMode: 'queued' | 'assigned' | 'running' | 'missing' = 'queued';
  public queueScanId?: string;
  public ambiguousCreate = false;
  public maskBlackboxCredentials = false;
  public onWrite?: (path: string, body: JsonObject) => void;
  private counter = 10;
  private comment = '';
  private readonly zip = archive();

  public api(token = 'synthetic-access') {
    return new AieApi('https://aie.test', token, this.request);
  }
  private nextId() {
    return `bbbbbbbb-bbbb-bbbb-bbbb-${String(this.counter++).padStart(12, '0')}`;
  }

  public request: typeof fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = init.method ?? 'GET';
    const pathname = decodeURIComponent(url.pathname);
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    this.calls.push({
      method,
      path: pathname,
      body: structuredClone(body),
      authorization: new Headers(init.headers).get('authorization'),
    });
    const fault = this.faults.get(`${method} ${pathname}`);
    if (fault) {
      return json(fault.body ?? { errorCode: 'FORBIDDEN' }, fault.status);
    }
    const object = body && typeof body === 'object' && !Array.isArray(body) ? data(body) : {};
    if (method !== 'GET') {
      this.onWrite?.(pathname, object);
    }
    if (pathname === '/api/versions/package/current') {
      return new Response('6.4.0.1234', { headers: { 'Content-Type': 'text/plain' } });
    }
    if (pathname === '/api/auth/users/current') {
      return json({ id: ids.user, login: 'fixture' });
    }
    if (pathname.endsWith('/permissions')) {
      return json([]);
    }
    if (pathname === '/api/auth/refreshToken') {
      return json({ accessToken: 'refreshed-access' });
    }
    if (pathname === '/api/auth/signout') {
      return empty();
    }
    if (pathname === '/api/projects') {
      return json([{ id: ids.project, name: 'fixture', projectType: 'Permanent' }]);
    }
    if (pathname === `/api/branches/${ids.branch}/projectId`) {
      return json(ids.project);
    }
    if (pathname === `/api/branches/${ids.branch}`) {
      return json({ id: ids.branch, name: 'main', sourcesChangingDate: this.sourceDate });
    }
    if (pathname === `/api/projects/${ids.project}/branches`) {
      if (method === 'POST') {
        this.hasSources = false;
        return json(ids.branch);
      }
      return json([{ id: ids.branch, name: 'main' }]);
    }
    if (pathname === `/api/projects/${ids.project}/branches/working`) {
      return json(ids.branch);
    }
    if (pathname === `/api/branches/${ids.branch}/sourcesSettings`) {
      return json({ scanTargetName: this.hasSources ? 'sources' : null, localSourceType: 'Directory' });
    }
    if (pathname.startsWith(`/api/directoryContent/${ids.project}/branches/${ids.branch}`)) {
      return json({
        name: 'sources',
        _files: this.hasSources ? ['main.js'] : [],
        _directories: [],
        _hasContent: this.hasSources,
      });
    }
    if (pathname.startsWith(`/api/fileContent/${ids.project}/branches/${ids.branch}/`)) {
      return new Response('first line\nsecond line\nthird line', { headers: { 'Content-Type': 'text/plain' } });
    }
    if (pathname === `/api/branches/${ids.branch}/scanResults/last`) {
      return json([...this.scans.values()].at(-1));
    }
    if (pathname === `/api/branches/${ids.branch}/scanResults`) {
      return json([...this.scans.values()]);
    }
    if (pathname === `/api/projects/${ids.project}/defaultSettings`) {
      return json({
        id: ids.project,
        name: 'fixture',
        languages: ['JavaScript'],
        whiteBox: { patternMatchingEnabled: true, asintEnabled: false },
        blackBoxEnabled: false,
        priority: 'Medium',
        projectTargetBasedType: 'SourceBased',
      });
    }
    if (pathname === `/api/projects/${ids.project}/completeConfiguration`) {
      return empty();
    }
    const selected = new RegExp(
      `^/api/projects/${ids.project}/(settings|analysisRules|securityPolicies|blackBoxSettings|preferredAgentsSettings)$`,
    ).exec(pathname);
    if (selected) {
      const section = selected[1];
      if (method === 'PUT') {
        const prior = structuredClone(this.settings[section]);
        this.settings[section] = { ...this.settings[section], ...object };
        if (section === 'blackBoxSettings') {
          preserveFixtureSecrets(prior, this.settings[section]);
        }
        return empty();
      }
      if (section === 'blackBoxSettings' && this.maskBlackboxCredentials) {
        const masked = structuredClone(this.settings[section]);
        const hide = (node: unknown) => {
          if (node && typeof node === 'object') {
            for (const [key, value] of Object.entries(node)) {
              if ((key === 'password' || key === 'cookie') && typeof value === 'string') {
                data(node)[key] = '';
              } else {
                hide(value);
              }
            }
          }
        };
        hide(masked);
        return json(masked);
      }
      return json(this.settings[section]);
    }
    if (pathname === '/api/configs/securityPoliciesTemplate') {
      return json('[{ /* policy */ "CountToActualize":1,}]');
    }
    if (pathname === `/api/projects/${ids.project}/scanSettings/${ids.settings}`) {
      return json({ id: ids.settings, programmingLanguages: ['JavaScript'] });
    }
    const scan = new RegExp(`^/api/projects/${ids.project}/scanResults/([^/]+)(?:/(.*))?$`).exec(pathname);
    if (scan) {
      if (!scan[2]) {
        return json(this.scans.get(scan[1]) ?? {}, this.scans.has(scan[1]) ? 200 : 404);
      }
      if (scan[2] === 'issues') {
        return json(this.issues ?? [this.issue]);
      }
      if (scan[2] === 'errors') {
        return json([{ level: 'Warning', message: 'synthetic diagnostic', isCritical: false }]);
      }
    }
    if (pathname === `/api/projects/${ids.project}/issues/${ids.issue}`) {
      return json(this.issue);
    }
    if (pathname === `/api/projects/${ids.project}/issues/${ids.issue}/state`) {
      if (this.issue.approvalState === object.state) {
        return empty();
      }
      this.issue.approvalState = object.state;
      this.comment = String(object.comment);
      return empty();
    }
    if (pathname === `/api/projects/${ids.project}/issues/${ids.issue}/comment`) {
      this.comment = String(object.comment);
      return empty();
    }
    const resource = new RegExp(`^/api/projects/${ids.project}/issues/([^/]+)/resources$`).exec(pathname);
    if (resource) {
      const issue = (this.issues ?? [this.issue]).find((item) => item.id === resource[1]);
      return json([
        {
          identity: issue?.type,
          title: this.titles.get(String(issue?.id)) ?? this.titles.get(String(issue?.type)) ?? issue?.type ?? 'fixture',
        },
      ]);
    }
    if (pathname === `/api/history/branches/${ids.branch}`) {
      return json([
        {
          id: this.comment ? 2 : 1,
          relatedEntityId: ids.issue,
          changeObjectType: 'IssueApprovalState',
          changedDateTime: '2026-11-10T12:00:00Z',
          comment: this.comment,
        },
      ]);
    }
    if (pathname === '/api/agents') {
      return json([{ id: ids.agent, name: 'fixture-agent' }]);
    }
    if (pathname === `/api/agents/${ids.agent}`) {
      return json({ id: ids.agent, name: 'fixture-agent' });
    }
    if (pathname === '/api/configs/pmRules') {
      if (method === 'GET') {
        return json([...this.rules.values()]);
      }
      const id = `custom-rule-${this.counter++}`;
      this.rules.set(id, { ...object, id, vulnerabilityType: { id: object.vulnerabilityTypeId } });
      if (this.ambiguousCreate) {
        this.rules.set(id + '-concurrent', {
          ...object,
          id: id + '-concurrent',
          vulnerabilityType: { id: object.vulnerabilityTypeId },
        });
      }
      return empty();
    }
    const rule = /^\/api\/configs\/pmRules\/([^/]+)$/.exec(pathname);
    if (rule) {
      if (method === 'PUT') {
        this.rules.set(rule[1], { ...object, id: rule[1], vulnerabilityType: { id: object.vulnerabilityTypeId } });
        return empty();
      }
      return json(this.rules.get(rule[1]) ?? {}, this.rules.has(rule[1]) ? 200 : 404);
    }
    if (pathname === '/api/configs/pmGroups') {
      if (method === 'GET') {
        return json(
          [...this.groups.values()].map((group) => ({
            id: group.id,
            name: group.name,
            rulesCount: data(group).rules instanceof Array ? (group.rules as unknown[]).length : 0,
          })),
        );
      }
      const id = this.nextId();
      this.groups.set(id, { ...object, id });
      return empty();
    }
    const group = /^\/api\/configs\/pmGroups\/([^/]+)(?:\/(rules))?$/.exec(pathname);
    if (group) {
      const entry = this.groups.get(group[1]);
      if (!entry) {
        return json({}, 404);
      }
      if (group[2]) {
        return json((entry.rules as string[]).map((id) => ({ id })));
      }
      if (method === 'PATCH') {
        this.groups.set(group[1], { ...entry, ...object });
        return json(group[1]);
      }
      return json({ id: entry.id, name: entry.name, rulesCount: (entry.rules as string[]).length });
    }
    if (pathname === `/api/projects/${ids.project}` && method === 'GET') {
      return json({ id: ids.project, projectType: 'Permanent' });
    }
    if (pathname === '/api/pmRuleVulnTypes') {
      if (method === 'GET') {
        return json([...this.types.values()]);
      }
      const id = this.nextId();
      this.types.set(id, { ...object, id });
      return json(id);
    }
    const type = /^\/api\/pmRuleVulnTypes\/([^/]+)$/.exec(pathname);
    if (type) {
      return json(this.types.get(type[1]) ?? {}, this.types.has(type[1]) ? 200 : 404);
    }
    if (
      pathname === '/api/store/project/archive' ||
      pathname === `/api/store/${ids.project}/branches/${ids.branch}/sources`
    ) {
      if (method === 'GET') {
        return new Response(new Uint8Array(await this.zip).buffer, { headers: { 'Content-Type': 'application/zip' } });
      }
      if (init.body) {
        for await (const chunk of init.body as unknown as AsyncIterable<Uint8Array>) {
          void chunk;
          /* Consume the actual streaming body. */
        }
      }
      this.sourceDate = new Date(Date.parse(this.sourceDate) + 1000).toISOString();
      this.hasSources = true;
      return pathname.endsWith('/archive') ? json({ projectId: ids.project, branchId: ids.branch }) : empty();
    }
    if (pathname === '/api/scanQueue/items' && method === 'POST') {
      {
        this.queueScanId = this.nextId();
        this.scans.set(this.queueScanId, {
          id: this.queueScanId,
          projectId: ids.project,
          branchId: ids.branch,
          settingsId: ids.settings,
          progress: { stage: this.queueMode === 'queued' ? 'Enqueued' : 'Scan', value: 15 },
          scanLabel: object.scanLabel,
          initiator: { id: ids.user },
          queueDate: new Date().toISOString(),
          scanDate: new Date().toISOString(),
          hasErrors: true,
          scanType: object.scope,
        });
      }
      return json(ids.queue);
    }
    if (pathname === `/api/scanQueue/items/${ids.queue}`) {
      if (method === 'DELETE') {
        this.queueMode = 'missing';
        return empty();
      }
      if (this.queueMode === 'assigned') {
        return json({ errorCode: 'QUEUE_ITEM_ALREADY_ASSIGNED_TO_AGENT' }, 400);
      }
      if (this.queueMode === 'missing') {
        return json({ errorCode: 'QUEUE_ITEM_NOT_FOUND' }, 400);
      }
      return json({
        id: ids.queue,
        scanObject: { projectId: ids.project, branchId: ids.branch },
        scanResultId: this.queueScanId ?? '00000000-0000-0000-0000-000000000000',
      });
    }
    const stop = /^\/api\/scans\/([^/]+)\/stop$/.exec(pathname);
    if (stop) {
      const entry = this.scans.get(stop[1]);
      if (entry) {
        entry.progress = { stage: 'Aborted', value: 0 };
      }
      return empty();
    }
    throw new Error(`Fixture route not implemented: ${method} ${pathname}`);
  };
}
