export const SourceMatch = { Unknown: 'unknown' } as const;

export interface IssueFilters {
  type?: string;
  scan_module?: string[];
  file?: string;
  location?: 'source' | 'entry_point' | 'either';
  start_line?: number;
  end_line?: number;
  severity?: string[];
  approval_state?: string[];
  issue_type?: string[];
  is_new?: boolean;
  path?: string;
  counter?: number;
}

export const IssueView = { Items: 'items', Summary: 'summary' } as const;
export type IssueView = (typeof IssueView)[keyof typeof IssueView];
export const Location = { Source: 'source', Entry: 'entry_point', Either: 'either' } as const;
