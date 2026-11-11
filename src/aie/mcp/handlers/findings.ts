import { type IssueFilters } from '../../projects/models.js';
import { AieToolName } from '../../tool-names.js';
import { type ToolHandlers } from '../handler-contract.js';

export const findingHandlers: Pick<ToolHandlers, Names> = {
  [AieToolName.ListIssues]: (args, context) => {
    const { project_id, scan_id, branch_id } = args;
    const filters: IssueFilters = {
      severity: args.severity,
      approval_state: args.approval_state,
      issue_type: args.issue_type,
      is_new: args.is_new,
      path: args.path,
      counter: args.counter,
    };

    return context.list(AieToolName.ListIssues, { project_id, branch_id, scan_id, ...filters }, args, () =>
      context.findings.list(project_id, scan_id, filters, branch_id),
    );
  },
  [AieToolName.GetIssueDetails]: (args, context) =>
    context.findings.details(args.project_id, args.scan_id, args.issue_id, args.branch_id),
  [AieToolName.TriageIssue]: (args, context) =>
    context.findings.triage(args.project_id, args.scan_id, args.issue_id, args.state, args.comment, args.branch_id),
};

type Names = typeof AieToolName.ListIssues | typeof AieToolName.GetIssueDetails | typeof AieToolName.TriageIssue;
