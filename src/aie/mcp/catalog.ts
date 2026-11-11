import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SchemaObject } from 'ajv';
import { AuthAction } from '../auth/models.js';
import { PmAction, PmKind } from '../pm/models.js';
import { SettingsSection } from '../settings/models.js';
import { AieToolName } from '../tool-names.js';
import type { ToolArguments } from './tool-contract.js';

const nonEmptyStringSchema = { type: 'string', minLength: 1 } as const satisfies SchemaObject;
const uuidSchema = { ...nonEmptyStringSchema, format: 'uuid' } as const satisfies SchemaObject;
const projectTargetProperties = { project_id: uuidSchema };
const branchTargetProperties = { ...projectTargetProperties, branch_id: uuidSchema };
const scanTargetProperties = { ...projectTargetProperties, scan_id: uuidSchema, branch_id: uuidSchema };
const issueTargetProperties = { ...scanTargetProperties, issue_id: uuidSchema };
const paginationProperties = {
  page_size: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  cursor: nonEmptyStringSchema,
};

const settingsSectionSchema = { type: 'string', enum: Object.values(SettingsSection) } as const satisfies SchemaObject;
const pmKindSchema = { type: 'string', enum: Object.values(PmKind) } as const satisfies SchemaObject;
const jsonObjectSchema = { type: 'object' } as const satisfies SchemaObject;

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
    properties: { ...branchTargetProperties, ...paginationProperties },
    required: ['project_id', 'branch_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.ListIssues,
    description:
      'Read a short findings page for a scan. Filters combine with AND; values inside a filter use OR. is_new is the server baseline flag. Issue type is the finding category; counter is the UI number, not the ID.',
    properties: {
      ...scanTargetProperties,
      ...paginationProperties,
      severity: { type: 'array', items: nonEmptyStringSchema },
      approval_state: { type: 'array', items: { type: 'string', enum: ['Approval', 'Discard', 'None'] } },
      issue_type: { type: 'array', items: nonEmptyStringSchema },
      is_new: { type: 'boolean' },
      path: nonEmptyStringSchema,
      counter: { type: 'integer', minimum: 0 },
    },
    required: ['project_id', 'scan_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.GetIssueDetails,
    description:
      'Read full finding details/evidence/dataflow by known project, scan and issue IDs. Local code or a branch archive may differ from the historical scan; verify the revision before triage.',
    properties: issueTargetProperties,
    required: ['project_id', 'scan_id', 'issue_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.TriageIssue,
    description:
      'Save a manual Approval/Discard/None status and comment, then verify by readback. Supply reasoning based on actually inspected code/evidence.',
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
    name: AieToolName.CreateProject,
    description:
      'Create a permanent AIE project from local sources and complete its initial configuration. Background operation. Excludes .git, own staging paths and files ignored by root .aiignore/.ptaiignore (gitignore syntax; both exclusion sets are combined). Symlinks are skipped. Local .aiproj.json is unchanged.',
    properties: {
      source_directory: nonEmptyStringSchema,
      name: nonEmptyStringSchema,
      branch_name: nonEmptyStringSchema,
      description: { type: 'string' },
      scan_changes: jsonObjectSchema,
    },
    required: ['source_directory', 'name', 'branch_name'],
    readOnly: false,
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
      'Read ONE project settings section and its write schema/revision. With scan_id, only section=scan is historical; other sections remain current and say so. include_template reads the policy template.',
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
      'Queue analysis of a selected branch as a background operation after source readiness. scope defaults to Incremental. queue_id and scan_id are distinct; never assume the latest external scan is ours.',
    properties: {
      ...branchTargetProperties,
      scope: { type: 'string', enum: ['Full', 'Incremental'], default: 'Incremental' },
      label: { type: 'string' },
    },
    required: ['project_id', 'branch_id'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.GetScanStatus,
    description:
      'Read one selected queue OR scan with progress/statistics and paged messages. Supply exactly one queue_id/scan_id. A successfully read Failed scan is a successful tool result; Done does not guarantee complete checks or no warnings.',
    properties: {
      ...branchTargetProperties,
      queue_id: uuidSchema,
      scan_id: uuidSchema,
      include_diagnostics: { type: 'boolean' },
      ...paginationProperties,
    },
    required: ['project_id', 'branch_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.StopScan,
    description:
      'Request removal of one queued item OR stop of one running scan. Supply exactly one queue_id/scan_id. Acceptance is distinct from confirmed stop; poll the selected run afterward.',
    properties: { ...branchTargetProperties, queue_id: uuidSchema, scan_id: uuidSchema },
    required: ['project_id', 'branch_id'],
    readOnly: false,
  }),
  defineTool({
    name: AieToolName.GetOperation,
    description:
      'Read a Node background workflow including completed stages, known IDs, effects and terminal result. Jobs live only in the current process. Polling does not repeat server changes.',
    properties: { operation_id: nonEmptyStringSchema },
    required: ['operation_id'],
    readOnly: true,
  }),
  defineTool({
    name: AieToolName.CancelOperation,
    description:
      'Cooperatively cancel a Node workflow. Already applied server changes are not rolled back; inspect the returned effects/IDs. Stop a server analysis separately with aie_stop_scan.',
    properties: { operation_id: nonEmptyStringSchema },
    required: ['operation_id'],
    readOnly: false,
  }),
];

function defineTool<Name extends AieToolName>(definition: ToolDefinition<Name>): Tool {
  const { name, description, properties, required, readOnly } = definition;

  return {
    name,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: true },
  };
}

interface ToolDefinition<Name extends AieToolName> {
  name: Name;
  description: string;
  properties: { [Key in keyof ToolArguments[NoInfer<Name>]]-?: SchemaObject };
  required: Array<keyof ToolArguments[NoInfer<Name>] & string>;
  readOnly: boolean;
}
