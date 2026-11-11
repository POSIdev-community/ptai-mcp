import { Ajv } from 'ajv';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { aieCatalog } from './catalog.js';
import { AieError, safeError } from './errors.js';
import { result } from './result.js';
import { Sessions } from './session.js';
import { Operations } from './operations.js';
import { Pages } from './pagination.js';
import { Findings, type IssueFilters } from './findings.js';
import { Settings, type Section } from './settings.js';
import { PmCatalog, type Kind } from './pm.js';
import { Scans, type RunTracker } from './scans.js';
import { Sources } from './sources.js';
import { record, type Data } from './schema.js';
import { createTelemetry, type Telemetry } from '../telemetry/telemetry.js';

const validator = new Ajv({ strict: false, allErrors: true });
validator.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const schemas = new Map(aieCatalog.map((tool) => [tool.name, validator.compile(tool.inputSchema)]));

export class AieDispatcher {
  readonly operations: Operations;
  readonly pages = new Pages();
  readonly sessions: Sessions;
  private readonly runs: RunTracker = new Map();
  private readonly busy = new Set<string>();
  private readonly terminalScans = new Set<string>();

  constructor(
    sessions?: Sessions,
    private readonly telemetry: Telemetry = createTelemetry(),
  ) {
    this.operations = new Operations((operation, state) =>
      this.action(
        operation,
        state === 'succeeded' ? 'applied' : state === 'cancelled' ? 'cancelled' : 'error',
        this.sessions.currentVersion,
      ),
    );
    this.sessions =
      sessions ??
      new Sessions(undefined, undefined, (identity) => {
        this.operations.cancelIdentity(identity);
        this.pages.clear();
        this.runs.clear();
      });
    this.sessions.onAction = (action, outcome, version) => this.action(action, outcome, version);
  }

  async call(name: string, args: Data = {}): Promise<CallToolResult> {
    const started = performance.now();
    let response: CallToolResult;
    try {
      const validate = schemas.get(name);
      if (!validate || !validate(args))
        throw new AieError('AIE_VALIDATION_ERROR', 'Tool arguments do not match its schema.', {
          effects: 'not_applied',
        });
      const value = await this.run(name, args);
      response = result(value);
      if (
        ['aie_triage_issue', 'aie_update_project_settings', 'aie_save_pm_catalog_entry', 'aie_stop_scan'].includes(
          name,
        ) &&
        value.effects === 'applied'
      ) {
        this.action(
          name,
          value.stop_requested || value.verified === false ? 'accepted' : 'applied',
          this.sessions.currentVersion,
        );
      }
    } catch (error) {
      response = result({ error: safeError(error, name) }, true);
    }
    try {
      this.telemetry.invocation(name, response, performance.now() - started, args, this.sessions.currentVersion);
    } catch {
      /* Metrics never change the tool response. */
    }
    return response;
  }
  async close() {
    this.sessions.close();
    await this.operations.close();
    this.pages.clear();
    await this.telemetry.close().catch(() => undefined);
  }
  private action(action: string, outcome: string, version?: string) {
    try {
      this.telemetry.action(action, outcome, version);
    } catch {
      /* Telemetry cannot change workflow/auth results. */
    }
  }

  private async run(name: string, args: Data): Promise<Data> {
    const string = (key: string) => args[key] as string;
    const optional = (key: string) => args[key] as string | undefined;
    if (name === 'aie_auth') return this.sessions.auth(args as unknown as Parameters<Sessions['auth']>[0]);
    if (name === 'aie_get_context') return this.sessions.context(optional('login_id'));
    const session = await this.sessions.require();
    const { api, identity } = session;
    const projectId = string('project_id');
    const branchId = string('branch_id');
    const scanId = string('scan_id');
    const page = { cursor: optional('cursor'), page_size: args.page_size as number | undefined };
    const list = (query: Data, load: () => Promise<unknown[]>) => this.pages.list(identity, name, query, page, load);
    const findings = new Findings(api);
    const settings = new Settings(api);
    const pm = new PmCatalog(api);
    const scans = new Scans(api, this.runs);
    const sources = new Sources(api);
    const target =
      name === 'aie_cancel_operation'
        ? `operation:${string('operation_id')}`
        : name === 'aie_download_project'
          ? `download:${string('destination')}`
          : name === 'aie_stop_scan'
            ? `scan:${projectId}:${String(args.scan_id ?? args.queue_id)}`
            : args.project_id
              ? `project:${projectId}`
              : args.kind
                ? `pm:${String(args.kind)}`
                : 'create-project';
    const changing = !aieCatalog.find((tool) => tool.name === name)?.annotations?.readOnlyHint;
    const key = `${identity}:${target}`;
    if (changing && (this.busy.has(key) || this.operations.isBusy(identity, target)))
      throw new AieError('AIE_TARGET_BUSY', 'Another change is active for this target.', { effects: 'not_applied' });
    if (changing) this.busy.add(key);
    try {
      switch (name) {
        case 'aie_list_projects':
          return list({ name: args.name }, async () =>
            (await api.json(api.projects.apiProjectsGetRaw({})))
              .filter((project) => !args.name || project.name?.toLowerCase().includes(string('name').toLowerCase()))
              .map((project) => ({
                id: project.id,
                name: project.name,
                project_type: project.projectType,
                project_target_type: project.projectTargetBasedType,
                creation_date: project.creationDate,
              })),
          );
        case 'aie_list_branches':
          return list({ project_id: projectId }, () =>
            api.json(api.projects.apiProjectsProjectIdBranchesGetRaw({ projectId })),
          );
        case 'aie_list_scans':
          await findings.branch(projectId, branchId);
          return list({ project_id: projectId, branch_id: branchId }, async () =>
            (await api.json(api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId }))).map((scan) => ({
              id: scan.id,
              project_id: scan.projectId,
              branch_id: scan.branchId,
              scan_date: scan.scanDate,
              queue_date: scan.queueDate,
              progress: scan.progress,
              statistics: scan.statistic,
              scan_type: scan.scanType,
              label: scan.scanLabel,
              has_errors: scan.hasErrors,
              previous_scan_id: scan.previousScanResultId,
            })),
          );
        case 'aie_list_issues': {
          const filters: IssueFilters = {
            severity: args.severity as string[] | undefined,
            approval_state: args.approval_state as string[] | undefined,
            issue_type: args.issue_type as string[] | undefined,
            is_new: args.is_new as boolean | undefined,
            path: optional('path'),
            counter: args.counter as number | undefined,
          };
          return list({ project_id: projectId, branch_id: args.branch_id, scan_id: scanId, ...filters }, () =>
            findings.list(projectId, scanId, filters, optional('branch_id')),
          );
        }
        case 'aie_get_issue_details':
          return findings.details(projectId, scanId, string('issue_id'), optional('branch_id'));
        case 'aie_triage_issue':
          return findings.triage(
            projectId,
            scanId,
            string('issue_id'),
            args.state as 'Approval' | 'Discard' | 'None',
            string('comment'),
            optional('branch_id'),
          );
        case 'aie_get_project_settings':
          return settings.get(projectId, args.section as Section, optional('scan_id'), args.include_template === true);
        case 'aie_update_project_settings':
          return settings.update(projectId, args.section as Section, record(args.changes), optional('base_revision'));
        case 'aie_list_pm_catalog': {
          const kind = args.kind as Kind;
          const data = await list({ kind, include_create_schema: args.include_create_schema }, async () =>
            (await pm.list(kind)).map((item) => {
              const entry = record(item);
              return {
                id: entry.id,
                name: entry.name,
                description: entry.description,
                level: entry.level,
                rules_count: entry.rulesCount,
                modified_date: entry.modifiedDate,
              };
            }),
          );
          return { ...data, kind, create_schema: args.include_create_schema ? pm.schema(kind) : undefined };
        }
        case 'aie_get_pm_catalog_entry':
          return pm.entry(args.kind as Kind, string('id'));
        case 'aie_save_pm_catalog_entry':
          return pm.save(
            args.kind as Kind,
            args.action as 'create' | 'update',
            optional('id'),
            args.value as Data | undefined,
            args.changes as Data | undefined,
            optional('base_revision'),
          );
        case 'aie_list_scan_agents':
          return list({ id: args.id }, async () =>
            args.id ? [await api.json(api.agents.getRaw({ agentId: string('id') }))] : api.json(api.agents.getAllRaw()),
          );
        case 'aie_get_operation':
          return this.operations.get(identity, string('operation_id'));
        case 'aie_cancel_operation':
          return this.operations.cancel(identity, string('operation_id'));
        case 'aie_create_project':
          return this.operations.start(identity, name, target, async (job) => {
            await this.sessions.assertIdentity(identity);
            return sources.create(
              string('source_directory'),
              string('name'),
              string('branch_name'),
              optional('description'),
              args.scan_changes as Data | undefined,
              job,
            );
          });
        case 'aie_upload_sources':
          return this.operations.start(identity, name, target, async (job) => {
            await this.sessions.assertIdentity(identity);
            return sources.upload(projectId, branchId, string('source_directory'), job);
          });
        case 'aie_download_project':
          return this.operations.start(identity, name, `download:${string('destination')}`, async (job) => {
            await this.sessions.assertIdentity(identity);
            return sources.download(projectId, branchId, string('destination'), optional('scan_id'), job);
          });
        case 'aie_start_scan':
          return this.operations.start(identity, name, target, async (job) => {
            await this.sessions.assertIdentity(identity);
            return scans.start(
              projectId,
              branchId,
              (args.scope as 'Full' | 'Incremental' | undefined) ?? 'Incremental',
              optional('label'),
              job,
            );
          });
        case 'aie_get_scan_status': {
          const status = await scans.status(projectId, branchId, optional('queue_id'), optional('scan_id'));
          const terminalKey = `${identity}:${String(status.scan_id)}`;
          if (status.terminal && !this.terminalScans.has(terminalKey)) {
            this.terminalScans.add(terminalKey);
            if (this.terminalScans.size > 1000) this.terminalScans.delete(this.terminalScans.values().next().value!);
            this.action('scan_terminal', String(status.state), session.version);
          }
          const diagnostics = args.include_diagnostics ?? (status.state === 'failed' || status.has_errors === true);
          return {
            ...status,
            diagnostics:
              diagnostics && typeof status.scan_id === 'string'
                ? await scans.diagnostics(identity, projectId, status.scan_id, this.pages, page)
                : { requested: false },
          };
        }
        case 'aie_stop_scan':
          return scans.stop(projectId, branchId, optional('queue_id'), optional('scan_id'));
        default:
          throw new AieError('AIE_TOOL_UNKNOWN', 'Unknown AIE tool.');
      }
    } finally {
      if (changing) this.busy.delete(key);
    }
  }
}
