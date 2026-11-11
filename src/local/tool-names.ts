import type { localCatalog } from './catalog.js';

/** Local analyzer tools; the snapshot in catalog.ts defines their external contract. */
export const LocalToolName = {
  GetScanErrors: 'get_scan_errors',
  SetActiveProject: 'set_active_project',
  GetIssueDetails: 'get_issue_details',
  GetScanStatus: 'get_scan_status',
  TriggerScan: 'trigger_scan',
  TriageIssue: 'triage_issue',
  ListIssues: 'list_issues',
  GetIssuesByLocation: 'get_issues_by_location',
  GetScanHistory: 'get_scan_history',
  StopScan: 'stop_scan',
  ModifyScanSettings: 'modify_scan_settings',
} as const satisfies Record<string, (typeof localCatalog.tools)[number]['name']>;

export type LocalToolName = (typeof LocalToolName)[keyof typeof LocalToolName];
