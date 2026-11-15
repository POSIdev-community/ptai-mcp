import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SchemaObject } from 'ajv';
import { IssueType } from '../../vendor/aie-v63/src/models/index.js';
import { AuthAction } from '../auth/models.js';
import { PmAction, PmKind } from '../pm/models.js';
import { IssueView, Location } from '../projects/models.js';
import { ScanState } from '../scans/scan-status.js';
import { SettingsSection } from '../settings/models.js';
import { CreateKind } from '../sources/models.js';
import { SourceKind } from '../sources/source-reader.js';
import { AieToolName } from '../tool-names.js';
import type { ToolArguments } from './tool-contract.js';

const nonEmptyStringSchema = { type: 'string', minLength: 1 } as const satisfies SchemaObject;
const uuidSchema = { ...nonEmptyStringSchema, format: 'uuid' } as const satisfies SchemaObject;
const projectTargetProperties = { project_id: uuidSchema };
const branchTargetProperties = { ...projectTargetProperties, branch_id: uuidSchema };
const scanTargetProperties = { ...projectTargetProperties, scan_id: uuidSchema, branch_id: uuidSchema };
const issueTargetProperties = { ...scanTargetProperties, issue_id: uuidSchema };
const paginationProperties = {
  page_size: {
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Items per page (default 20, max 100). total counts all matching items; summary total counts groups.',
  },
  cursor: {
    ...nonEmptyStringSchema,
    description:
      'For the next page, pass next_cursor with the SAME target, filters and page_size (size may be omitted). Null next_cursor ends the list. Immutable snapshot expires 10 minutes after creation or on restart; complete=false means more pages.',
  },
};

const settingsSectionSchema = { type: 'string', enum: Object.values(SettingsSection) } as const satisfies SchemaObject;
const pmKindSchema = { type: 'string', enum: Object.values(PmKind) } as const satisfies SchemaObject;
const jsonObjectSchema = { type: 'object' } as const satisfies SchemaObject;
const operationProperties = { operation_id: nonEmptyStringSchema, ...branchTargetProperties, scan_id: uuidSchema };
const operationAlternatives = [
  {
    properties: { operation_id: nonEmptyStringSchema, project_id: false, branch_id: false, scan_id: false },
    required: ['operation_id'],
  },
  {
    properties: { operation_id: false, ...branchTargetProperties, scan_id: uuidSchema },
    required: ['project_id', 'branch_id', 'scan_id'],
  },
];

export const aieCatalog: Tool[] = [
  defineTool({
    name: AieToolName.Auth,
    description:
      'Explicit AIE login/logout/cancel_login. Login opens the system browser and returns login_id plus a local manual form. Never provide authorization codes or tokens in tool arguments/chat. A failed or cancelled login preserves the previous session.',
    properties: {
      action: { type: 'string', enum: Object.values(AuthAction) },
      server_url: nonEmptyStringSchema,
      force_login: { type: 'boolean' },
      login_id: nonEmptyStringSchema,
    },
    required: ['action'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.GetContext,
    description:
      'Read AIE session, advisory permissions and local login attempt state. Use login_id to poll a pending sign-in. Working calls are explicitly retried after login.',
    properties: { login_id: nonEmptyStringSchema },
    required: [],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.ListProjects,
    description: 'List accessible AIE projects with IDs and a compact summary.',
    properties: { ...paginationProperties, name: nonEmptyStringSchema },
    required: [],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.ListBranches,
    description: 'List branches of the explicitly selected project.',
    properties: { ...projectTargetProperties, ...paginationProperties },
    required: ['project_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.ListScans,
    description: 'List scan summaries of the explicitly selected branch; choose a concrete historical scan ID.',
    properties: {
      ...branchTargetProperties,
      ...paginationProperties,
      state: { type: 'array', items: { type: 'string', enum: Object.values(ScanState) } },
      label: { ...nonEmptyStringSchema, description: 'Exact readable label; it may match multiple launches.' },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
        description: 'Sort by scan date. desc with page_size=1 selects latest matching scan.',
      },
    },
    required: ['project_id', 'branch_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.ListIssues,
    description:
      'Read compact findings or summary groups for a scan. Filters combine with AND; array values use OR. Type search uses BE4P exact → substring → all words in any order, case-insensitive, first nonempty level before pagination. Searches internal type, description/CWE titles and component names; search metadata reports unavailable titles. issue_type is the AIE category, not SQL Injection/XSS; is_new is the server baseline flag, counter is the UI number. matched_issues counts all matches including Discard/suppressed; AIE statistics exclude them.',
    properties: {
      ...scanTargetProperties,
      ...paginationProperties,
      severity: { type: 'array', items: nonEmptyStringSchema },
      approval_state: { type: 'array', items: { type: 'string', enum: ['Approval', 'Discard', 'None'] } },
      issue_type: { type: 'array', items: { type: 'string', enum: Object.values(IssueType) } },
      type: {
        ...nonEmptyStringSchema,
        description:
          'Forgiving type/CWE-title/component search, e.g. sql injection, Pathname Restricted, lodash. Does not correct spelling.',
      },
      scan_module: {
        type: 'array',
        items: nonEmptyStringSchema,
        description:
          'Module names, e.g. RaceConditionDetection (6.4), StaticCodeAnalysis, PatternMatching. view=summary lists observed values. Races use issue_type=Vulnerability and type such as Toctou.',
      },
      file: {
        ...nonEmptyStringSchema,
        description: 'Exact relative file path, slash-normalized and case-insensitive.',
      },
      location: { type: 'string', enum: Object.values(Location), default: Location.Either },
      start_line: { type: 'integer', minimum: 1 },
      end_line: { type: 'integer', minimum: 1 },
      view: { type: 'string', enum: Object.values(IssueView), default: IssueView.Items },
      is_new: { type: 'boolean' },
      is_suppressed: { type: 'boolean', description: 'Exact suppression flag; omitted includes both values.' },
      path: nonEmptyStringSchema,
      counter: { type: 'integer', minimum: 0 },
    },
    required: ['project_id', 'scan_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.GetIssueDetails,
    description:
      'Read full finding evidence, including both race paths and sharedData. For reused incremental findings, verifies membership and returns issue_record_scan_id. Source revision remains unverified; check local or downloaded code before triage.',
    properties: issueTargetProperties,
    required: ['project_id', 'scan_id', 'issue_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.TriageIssue,
    description:
      'Save Approval/Discard/None and comment, verifying the selected issue. An unchanged state with a comment uses the comment endpoint. Empty comment with unchanged state is no-op. AIE asynchronously synchronizes statuses/comments by hash to other branches: verification does not cover that synchronization. Supply inspected evidence.',
    properties: {
      ...issueTargetProperties,
      state: { type: 'string', enum: ['Approval', 'Discard', 'None'] },
      comment: { type: 'string' },
    },
    required: ['project_id', 'scan_id', 'issue_id', 'state', 'comment'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.DownloadProject,
    description:
      'Download branch sources to a NEW local destination after the user has allowed access. Runs as a background operation. Existing destinations are never overwritten. Branch archives have snapshot_match=unknown for historical scans.',
    properties: { ...branchTargetProperties, destination: nonEmptyStringSchema, scan_id: uuidSchema },
    required: ['project_id', 'branch_id', 'destination'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.Create,
    description:
      'Create kind=project (permanent project plus initial branch/configuration) OR kind=branch (new branch in an existing project with sources). One call runs the workflow; use operation_id to observe. Branch mode preserves project settings and does not write user working-branch selection; the server-derived Plugin default may change (before/after IDs are returned). Excludes .git, staging, .aiignore/.ptaiignore matches; skips symlinks; local .aiproj.json is unchanged. Partial failures retain created IDs, without automatic deletion.',
    properties: {
      kind: { type: 'string', enum: Object.values(CreateKind) },
      project_id: uuidSchema,
      source_directory: nonEmptyStringSchema,
      name: nonEmptyStringSchema,
      branch_name: nonEmptyStringSchema,
      description: { type: 'string' },
      scan_changes: jsonObjectSchema,
    },
    required: ['kind', 'source_directory', 'branch_name'],
    alternatives: [
      {
        properties: { kind: { const: CreateKind.Project }, name: nonEmptyStringSchema, project_id: false },
        required: ['kind', 'name'],
      },
      {
        properties: { kind: { const: CreateKind.Branch }, project_id: uuidSchema, name: false, scan_changes: false },
        required: ['kind', 'project_id'],
      },
    ],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.GetSources,
    description:
      'Read current branch source tree or a bounded file range (default 200 lines, upstream 1 MiB, output 64 KiB). Prefer a known scan_id for nested/special paths; some 6.3 branch routes fail. scan_id validates context but does not freeze files: content_source=current_branch_sources_or_temp, snapshot_match=unknown. kind=tree is paginated; depth bounds traversal.',
    properties: {
      ...branchTargetProperties,
      ...paginationProperties,
      kind: { type: 'string', enum: Object.values(SourceKind) },
      path: { type: 'string' },
      scan_id: uuidSchema,
      start_line: { type: 'integer', minimum: 1 },
      end_line: { type: 'integer', minimum: 1 },
      depth: { type: 'integer', minimum: 1, maximum: 4, default: 1 },
    },
    required: ['project_id', 'branch_id', 'kind'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.UploadSources,
    description:
      'Upload local sources to an explicitly selected existing branch. Background operation. Excludes .git, own staging paths and files ignored by root .aiignore/.ptaiignore (gitignore syntax; both exclusion sets are combined). Symlinks are skipped. Local .aiproj.json is unchanged. Wait for confirmed source readiness before starting analysis.',
    properties: { ...branchTargetProperties, source_directory: nonEmptyStringSchema },
    required: ['project_id', 'branch_id', 'source_directory'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.GetProjectSettings,
    description:
      'Read one settings section, revision and current write schema. scan_id makes only section=scan values historical. In 6.4, scan settings expose searchForRaceConditionsEnabled and raceConditionSettings when available. include_template reads the policy template.',
    properties: {
      ...projectTargetProperties,
      section: settingsSectionSchema,
      scan_id: uuidSchema,
      include_template: { type: 'boolean' },
    },
    required: ['project_id', 'section'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.UpdateProjectSettings,
    description:
      'Patch ONE CURRENT project-wide section using its write schema. Nested objects merge; arrays replace. Preserves other fields and verifies visible changes by readback. Hidden BlackBox credentials are preserved when omitted; explicit replacements may return verified=false and verification.unverified_fields because AIE hides their values. base_revision detects changes before writing but is not atomic server CAS. Changes affect all project branches and future scans.',
    properties: {
      ...projectTargetProperties,
      section: settingsSectionSchema,
      changes: jsonObjectSchema,
      base_revision: nonEmptyStringSchema,
    },
    required: ['project_id', 'section', 'changes'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.ListPmCatalog,
    description:
      'List one PM catalog kind (rules/groups/types). include_create_schema returns its creation schema. PM entities are shared across projects.',
    properties: { ...paginationProperties, kind: pmKindSchema, include_create_schema: { type: 'boolean' } },
    required: ['kind'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.GetPmCatalogEntry,
    description:
      'Read one shared PM entity and its update schema/revision. Rule IDs are strings, not necessarily UUIDs. Group membership is included for safe editing.',
    properties: { kind: pmKindSchema, id: nonEmptyStringSchema },
    required: ['kind', 'id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.SavePmCatalogEntry,
    description:
      'Explicit create/update of a shared PM entity. create requires value; update requires id and changes. Types support create only. Group rename preserves rule membership. Shared changes can affect other projects; creation is never replayed to discover an ID.',
    properties: {
      kind: pmKindSchema,
      action: { type: 'string', enum: Object.values(PmAction) },
      id: nonEmptyStringSchema,
      value: jsonObjectSchema,
      changes: jsonObjectSchema,
      base_revision: nonEmptyStringSchema,
    },
    required: ['kind', 'action'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.ListScanAgents,
    description:
      'Read available server scan agents, or one agent by ID, for project preferred_agents selection. Permissions are checked by AIE at request time.',
    properties: { ...paginationProperties, id: uuidSchema },
    required: [],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.StartScan,
    description:
      'Queue one scan and normally return scan_id/current state in this call, without waiting for analysis completion. Total wait budget 45 seconds, otherwise returns operation_id/known IDs for follow-up. Label defaults MCP or MCP-<label_suffix>; it is descriptive, not unique and does not select modules. scope defaults Incremental. Exact queue mapping and inferred branch_history correlation are distinguished; ambiguous matches remain unconfirmed. Never repeat an accepted/uncertain enqueue automatically.',
    properties: {
      ...branchTargetProperties,
      scope: {
        type: 'string',
        enum: ['Full', 'Incremental'],
        default: 'Incremental',
        description:
          'Modules come from project settings or an uploaded .aiproj.json override. Read historical enabledScanModules to confirm which ran.',
      },
      label_suffix: {
        type: 'string',
        maxLength: 36,
        pattern: '^[. _A-Za-z0-9А-Яа-яЁё-]*$',
        description:
          'Optional readable suffix, e.g. SCA_SCAN gives MCP-SCA_SCAN. Empty gives MCP. No random suffix is added.',
      },
    },
    required: ['project_id', 'branch_id'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.GetOperation,
    description:
      'Read a local workflow by operation_id OR an explicit remote project/branch/scan_id. Launch jobs return workflow_state separately from scan_state and correlation. Optional paged diagnostics. Failed scan is a successful read. Local results remain readable offline under the same verified session; remote errors are separate. Jobs are current-process-only; polling never repeats mutations.',
    properties: { ...operationProperties, ...paginationProperties, include_diagnostics: { type: 'boolean' } },
    required: [],
    alternatives: operationAlternatives,
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.CancelOperation,
    description:
      'Cancel a local workflow OR stop an explicitly selected remote project/branch/scan_id. Cancelling a launch job requests remote stop only with exact queue correlation; branch_history requires explicit scan_id selection. Applied writes are not rolled back. Stop acceptance differs from confirmed terminal state; poll get_operation. Shutdown/logout do not stop remote scans.',
    properties: operationProperties,
    required: [],
    alternatives: operationAlternatives,
    readOnly: false,
  }),
];

function defineTool<Name extends AieToolName>(definition: ToolDefinition<Name>): Tool {
  const { name, description, properties, required, readOnly } = definition;

  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
      ...(definition.alternatives ? { oneOf: definition.alternatives } : {}),
    },
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: true },
  };
}

interface ToolDefinition<Name extends AieToolName> {
  name: Name;
  description: string;
  properties: { [Key in keyof ToolArguments[NoInfer<Name>]]-?: SchemaObject };
  required: Array<keyof ToolArguments[NoInfer<Name>] & string>;
  readOnly: boolean;
  alternatives?: SchemaObject[];
}
