import { AieToolName } from '../../tool-names.js';
import type { ToolContext } from '../context.js';
import type { ToolHandlers } from '../handler-contract.js';
import type { ToolArguments } from '../tool-contract.js';

export const findingHandlers: Pick<ToolHandlers, FindingToolNames> = {
  [AieToolName.ListIssues]: listIssues,
  [AieToolName.GetIssueDetails]: getIssueDetails,
  [AieToolName.TriageIssue]: triageIssue,
};

function listIssues(args: ListIssuesArguments, context: ToolContext) {
  const { project_id, scan_id, branch_id, view } = args;
  const filters = {
    severity: args.severity,
    approval_state: args.approval_state,
    issue_type: args.issue_type,
    is_new: args.is_new,
    path: args.path,
    counter: args.counter,
    type: args.type,
    scan_module: args.scan_module,
    file: args.file,
    location: args.location,
    start_line: args.start_line,
    end_line: args.end_line,
  };

  return context.list(AieToolName.ListIssues, { project_id, branch_id, scan_id, view, ...filters }, args, () =>
    context.findings.query(project_id, scan_id, filters, branch_id, view),
  );
}

function getIssueDetails(args: GetIssueDetailsArguments, context: ToolContext) {
  return context.findings.details(args.project_id, args.scan_id, args.issue_id, args.branch_id);
}

function triageIssue(args: TriageIssueArguments, context: ToolContext) {
  return context.findings.triage(
    args.project_id,
    args.scan_id,
    args.issue_id,
    args.state,
    args.comment,
    args.branch_id,
  );
}

type FindingToolNames =
  typeof AieToolName.ListIssues | typeof AieToolName.GetIssueDetails | typeof AieToolName.TriageIssue;

type ListIssuesArguments = ToolArguments[typeof AieToolName.ListIssues];
type GetIssueDetailsArguments = ToolArguments[typeof AieToolName.GetIssueDetails];
type TriageIssueArguments = ToolArguments[typeof AieToolName.TriageIssue];
