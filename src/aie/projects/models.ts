export const SourceMatch = { Unknown: 'unknown' } as const;

export interface IssueFilters {
  severity?: string[];
  approval_state?: string[];
  issue_type?: string[];
  is_new?: boolean;
  path?: string;
  counter?: number;
}
