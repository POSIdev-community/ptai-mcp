import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const text = { type: 'string', minLength: 1 };
const id = { ...text, format: 'uuid' };
const project = { project_id: id };
const branch = { ...project, branch_id: id };
const scan = { ...project, scan_id: id, branch_id: id };
const issue = { ...scan, issue_id: id };
const page = { page_size: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, cursor: text };
const section = { type: 'string', enum: ['scan', 'pm_groups', 'policies', 'blackbox', 'preferred_agents'] };
const kind = { type: 'string', enum: ['rules', 'groups', 'types'] };
const object = { type: 'object' };

function tool(
  name: string,
  description: string,
  properties: Record<string, object>,
  required: string[],
  readOnly: boolean,
): Tool {
  return {
    name,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: true },
  };
}

export const aieCatalog: Tool[] = [
  tool(
    'aie_auth',
    'Explicit AIE login/logout/cancel_login. Login opens the system browser and returns login_id plus a local manual form. Never provide authorization codes or tokens in tool arguments/chat. A failed or cancelled login preserves the previous session.',
    {
      action: { type: 'string', enum: ['login', 'logout', 'cancel_login'] },
      server_url: text,
      force_login: { type: 'boolean' },
      login_id: text,
    },
    ['action'],
    false,
  ),
  tool(
    'aie_get_context',
    'Read AIE session, advisory permissions and local login attempt state. Use login_id to poll a pending sign-in. Working calls are explicitly retried after login.',
    { login_id: text },
    [],
    true,
  ),
  tool(
    'aie_list_projects',
    'List accessible AIE projects with IDs and a compact summary.',
    { ...page, name: text },
    [],
    true,
  ),
  tool(
    'aie_list_branches',
    'List branches of the explicitly selected project.',
    { ...project, ...page },
    ['project_id'],
    true,
  ),
  tool(
    'aie_list_scans',
    'List scan summaries of the explicitly selected branch; choose a concrete historical scan ID.',
    { ...branch, ...page },
    ['project_id', 'branch_id'],
    true,
  ),
  tool(
    'aie_list_issues',
    'Read a short findings page for a scan. Filters combine with AND; values inside a filter use OR. is_new is the server baseline flag. Issue type is the finding category; counter is the UI number, not the ID.',
    {
      ...scan,
      ...page,
      severity: { type: 'array', items: text },
      approval_state: { type: 'array', items: { type: 'string', enum: ['Approval', 'Discard', 'None'] } },
      issue_type: { type: 'array', items: text },
      is_new: { type: 'boolean' },
      path: text,
      counter: { type: 'integer', minimum: 0 },
    },
    ['project_id', 'scan_id'],
    true,
  ),
  tool(
    'aie_get_issue_details',
    'Read full finding details/evidence/dataflow by known project, scan and issue IDs. Local code or a branch archive may differ from the historical scan; verify the revision before triage.',
    issue,
    ['project_id', 'scan_id', 'issue_id'],
    true,
  ),
  tool(
    'aie_triage_issue',
    'Save a manual Approval/Discard/None status and comment, then verify by readback. Supply reasoning based on actually inspected code/evidence.',
    { ...issue, state: { type: 'string', enum: ['Approval', 'Discard', 'None'] }, comment: { type: 'string' } },
    ['project_id', 'scan_id', 'issue_id', 'state', 'comment'],
    false,
  ),
  tool(
    'aie_download_project',
    'Download branch sources to a NEW local destination after the user has allowed access. Runs as a background operation. Existing destinations are never overwritten. Branch archives have snapshot_match=unknown for historical scans.',
    { ...branch, destination: text, scan_id: id },
    ['project_id', 'branch_id', 'destination'],
    false,
  ),
  tool(
    'aie_create_project',
    'Create a permanent AIE project from local sources and complete its initial configuration. Background operation. Excludes .git, own staging paths and files ignored by root .aiignore/.ptaiignore (gitignore syntax; both exclusion sets are combined). Symlinks are skipped. Local .aiproj is unchanged.',
    { source_directory: text, name: text, branch_name: text, description: { type: 'string' }, scan_changes: object },
    ['source_directory', 'name', 'branch_name'],
    false,
  ),
  tool(
    'aie_upload_sources',
    'Upload local sources to an explicitly selected existing branch. Background operation. Excludes .git, own staging paths and files ignored by root .aiignore/.ptaiignore (gitignore syntax; both exclusion sets are combined). Symlinks are skipped. Local .aiproj is unchanged. Wait for confirmed source readiness before starting analysis.',
    { ...branch, source_directory: text },
    ['project_id', 'branch_id', 'source_directory'],
    false,
  ),
  tool(
    'aie_get_project_settings',
    'Read ONE project settings section and its write schema/revision. With scan_id, only section=scan is historical; other sections remain current and say so. include_template reads the policy template.',
    { ...project, section, scan_id: id, include_template: { type: 'boolean' } },
    ['project_id', 'section'],
    true,
  ),
  tool(
    'aie_update_project_settings',
    'Patch ONE CURRENT project-wide section using its write schema. Nested objects merge; arrays replace. Preserves other fields and verifies visible changes by readback. Hidden BlackBox credentials are preserved when omitted; explicit replacements may return verified=false and verification.unverified_fields because AIE hides their values. base_revision detects changes before writing but is not atomic server CAS. Changes affect all project branches and future scans.',
    { ...project, section, changes: object, base_revision: text },
    ['project_id', 'section', 'changes'],
    false,
  ),
  tool(
    'aie_list_pm_catalog',
    'List one PM catalog kind (rules/groups/types). include_create_schema returns its creation schema. PM entities are shared across projects.',
    { ...page, kind, include_create_schema: { type: 'boolean' } },
    ['kind'],
    true,
  ),
  tool(
    'aie_get_pm_catalog_entry',
    'Read one shared PM entity and its update schema/revision. Rule IDs are strings, not necessarily UUIDs. Group membership is included for safe editing.',
    { kind, id: text },
    ['kind', 'id'],
    true,
  ),
  tool(
    'aie_save_pm_catalog_entry',
    'Explicit create/update of a shared PM entity. create requires value; update requires id and changes. Types support create only. Group rename preserves rule membership. Shared changes can affect other projects; creation is never replayed to discover an ID.',
    {
      kind,
      action: { type: 'string', enum: ['create', 'update'] },
      id: text,
      value: object,
      changes: object,
      base_revision: text,
    },
    ['kind', 'action'],
    false,
  ),
  tool(
    'aie_list_scan_agents',
    'Read available server scan agents, or one agent by ID, for project preferred_agents selection. Permissions are checked by AIE at request time.',
    { ...page, id },
    [],
    true,
  ),
  tool(
    'aie_start_scan',
    'Queue analysis of a selected branch as a background operation after source readiness. scope defaults to Incremental. queue_id and scan_id are distinct; never assume the latest external scan is ours.',
    {
      ...branch,
      scope: { type: 'string', enum: ['Full', 'Incremental'], default: 'Incremental' },
      label: { type: 'string' },
    },
    ['project_id', 'branch_id'],
    false,
  ),
  tool(
    'aie_get_scan_status',
    'Read one selected queue OR scan with progress/statistics and paged messages. Supply exactly one queue_id/scan_id. A successfully read Failed scan is a successful tool result; Done does not guarantee complete checks or no warnings.',
    { ...branch, queue_id: id, scan_id: id, include_diagnostics: { type: 'boolean' }, ...page },
    ['project_id', 'branch_id'],
    true,
  ),
  tool(
    'aie_stop_scan',
    'Request removal of one queued item OR stop of one running scan. Supply exactly one queue_id/scan_id. Acceptance is distinct from confirmed stop; poll the selected run afterward.',
    { ...branch, queue_id: id, scan_id: id },
    ['project_id', 'branch_id'],
    false,
  ),
  tool(
    'aie_get_operation',
    'Read a Node background workflow including completed stages, known IDs, effects and terminal result. Jobs live only in the current process. Polling does not repeat server changes.',
    { operation_id: text },
    ['operation_id'],
    true,
  ),
  tool(
    'aie_cancel_operation',
    'Cooperatively cancel a Node workflow. Already applied server changes are not rolled back; inspect the returned effects/IDs. Stop a server analysis separately with aie_stop_scan.',
    { operation_id: text },
    ['operation_id'],
    false,
  ),
];
