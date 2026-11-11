import type { JsonObject } from '../../shared/json.js';
import type { AuthArguments } from '../auth/models.js';
import { PmAction, type PmKind } from '../pm/models.js';
import { type IssueFilters } from '../projects/models.js';
import type { SettingsSection } from '../settings/models.js';
import { AieToolName } from '../tool-names.js';

export interface PageArguments {
  cursor?: string;
  page_size?: number;
}

export interface ToolArguments {
  [AieToolName.Auth]: AuthArguments;
  [AieToolName.GetContext]: { login_id?: string };
  [AieToolName.ListProjects]: PageArguments & { name?: string };
  [AieToolName.ListBranches]: ProjectArguments & PageArguments;
  [AieToolName.ListScans]: BranchArguments & PageArguments;
  [AieToolName.ListIssues]: ScanArguments & PageArguments & IssueFilters;
  [AieToolName.GetIssueDetails]: IssueArguments;
  [AieToolName.TriageIssue]: IssueArguments & { state: 'Approval' | 'Discard' | 'None'; comment: string };
  [AieToolName.DownloadProject]: BranchArguments & { destination: string; scan_id?: string };
  [AieToolName.CreateProject]: {
    source_directory: string;
    name: string;
    branch_name: string;
    description?: string;
    scan_changes?: JsonObject;
  };
  [AieToolName.UploadSources]: BranchArguments & { source_directory: string };
  [AieToolName.GetProjectSettings]: ProjectArguments & {
    section: SettingsSection;
    scan_id?: string;
    include_template?: boolean;
  };
  [AieToolName.UpdateProjectSettings]: ProjectArguments & {
    section: SettingsSection;
    changes: JsonObject;
    base_revision?: string;
  };
  [AieToolName.ListPmCatalog]: PageArguments & { kind: PmKind; include_create_schema?: boolean };
  [AieToolName.GetPmCatalogEntry]: { kind: PmKind; id: string };
  [AieToolName.SavePmCatalogEntry]: {
    kind: PmKind;
    action: (typeof PmAction)[keyof typeof PmAction];
    id?: string;
    value?: JsonObject;
    changes?: JsonObject;
    base_revision?: string;
  };
  [AieToolName.ListScanAgents]: PageArguments & { id?: string };
  [AieToolName.StartScan]: BranchArguments & { scope?: 'Full' | 'Incremental'; label?: string };
  [AieToolName.GetScanStatus]: RunArguments & PageArguments & { include_diagnostics?: boolean };
  [AieToolName.StopScan]: RunArguments;
  [AieToolName.GetOperation]: { operation_id: string };
  [AieToolName.CancelOperation]: { operation_id: string };
}

export type ToolCall<K extends AieToolName = AieToolName> = {
  [Name in K]: { name: Name; args: ToolArguments[Name] };
}[K];
export type ConnectedToolName = Exclude<AieToolName, typeof AieToolName.Auth | typeof AieToolName.GetContext>;
export type ConnectedToolCall<K extends ConnectedToolName = ConnectedToolName> = ToolCall<K>;
interface ProjectArguments {
  project_id: string;
}
interface BranchArguments extends ProjectArguments {
  branch_id: string;
}
interface ScanArguments extends ProjectArguments {
  scan_id: string;
  branch_id?: string;
}
interface IssueArguments extends ScanArguments {
  issue_id: string;
}
interface RunArguments extends BranchArguments {
  queue_id?: string;
  scan_id?: string;
}
