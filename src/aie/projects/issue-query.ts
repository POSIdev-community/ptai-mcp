import type { VulnerabilityModel } from '../api/contracts.js';
import { type IssueFilters, Location } from './models.js';

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

export function matches(issue: VulnerabilityModel, filters: IssueFilters): boolean {
  return (
    (!filters.severity?.length || filters.severity.includes(issue.level ?? '')) &&
    (!filters.approval_state?.length || filters.approval_state.includes(issue.approvalState ?? '')) &&
    (!filters.issue_type?.length || filters.issue_type.includes(issue.issueType ?? '')) &&
    (!filters.scan_module?.length || filters.scan_module.includes(issue.scanModule ?? '')) &&
    (filters.is_new === undefined || issue.isNew === filters.is_new) &&
    (filters.counter === undefined || issue.counter === filters.counter) &&
    (!filters.path ||
      [issue.sourceFile, issue.entryPointFile].some(
        (file) => file && normalizePath(file).includes(normalizePath(filters.path!)),
      )) &&
    matchesLocation(issue, filters)
  );
}

export function issueCard(issue: VulnerabilityModel) {
  return {
    id: issue.id,
    counter: issue.counter,
    type: issue.type,
    issue_type: issue.issueType,
    severity: issue.level,
    approval_state: issue.approvalState,
    is_new: issue.isNew,
    is_suppressed: issue.isSuppressed,
    scan_module: issue.scanModule,
    source_file: issue.sourceFile,
    source_begin_line: issue.sourceBeginLine,
    source_end_line: issue.sourceEndLine,
    source_begin_column: issue.sourceBeginColumn,
    source_end_column: issue.sourceEndColumn,
    entry_point_file: issue.entryPointFile,
    entry_point_line: issue.entryPointLine,
    component: issue.vulnerableComponent ?? issue.vulnerableScaComponent,
  };
}

export function summarizeIssues(issues: VulnerabilityModel[]) {
  const groups = new Map<string, { group: string; value: string; count: number }>();

  for (const issue of issues) {
    const values = {
      severity: issue.level,
      approval_state: issue.approvalState,
      type: issue.type,
      file: issue.sourceFile,
    };

    for (const [group, value] of Object.entries(values)) {
      const key = JSON.stringify([group, value ?? 'unknown']);
      const current = groups.get(key) ?? { group, value: value ?? 'unknown', count: 0 };
      current.count++;
      groups.set(key, current);
    }
  }

  return [...groups.values()].sort(
    (a, b) => a.group.localeCompare(b.group) || b.count - a.count || a.value.localeCompare(b.value),
  );
}

function matchesLocation(issue: VulnerabilityModel, filters: IssueFilters): boolean {
  if (!filters.file && filters.start_line === undefined && filters.end_line === undefined) {
    return true;
  }

  const selected = selectLocations(issue, filters.location);
  const file = filters.file ? normalizePath(filters.file) : undefined;
  const hasLines = filters.start_line !== undefined || filters.end_line !== undefined;
  const from = filters.start_line ?? 1;
  const to = filters.end_line ?? filters.start_line ?? Infinity;

  return selected.some((location) => {
    if (filters.file && (!location.path || normalizePath(location.path) !== file)) {
      return false;
    }

    if (!hasLines) {
      return true;
    }

    return location.from != null && location.from <= to && (location.to ?? location.from) >= from;
  });
}

function selectLocations(issue: VulnerabilityModel, location: IssueFilters['location']) {
  const source = { path: issue.sourceFile, from: issue.sourceBeginLine, to: issue.sourceEndLine };
  const entry = { path: issue.entryPointFile, from: issue.entryPointLine, to: issue.entryPointLine };

  switch (location) {
    case Location.Source:
      return [source];
    case Location.Entry:
      return [entry];
    default:
      return [source, entry];
  }
}
