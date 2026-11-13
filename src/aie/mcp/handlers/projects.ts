import { normalizeScanState, ScanOrder } from '../../scans/scan-status.js';
import { AieToolName } from '../../tool-names.js';
import type { ToolContext } from '../context.js';
import { type ToolHandlers } from '../handler-contract.js';
import type { ToolArguments } from '../tool-contract.js';

export const projectHandlers: Pick<ToolHandlers, ProjectToolNames> = {
  [AieToolName.ListProjects]: listProjects,
  [AieToolName.ListBranches]: listBranches,
  [AieToolName.ListScans]: listScans,
  [AieToolName.ListScanAgents]: listScanAgents,
};

function listProjects(args: ListProjectsArguments, context: ToolContext) {
  return context.list(AieToolName.ListProjects, { name: args.name }, args, async () => {
    const { api } = context.session;
    const projects = await api.json(api.projects.apiProjectsGetRaw({}));
    const filter = args.name?.toLowerCase();

    return projects
      .filter((project) => !filter || project.name?.toLowerCase().includes(filter))
      .map((project) => ({
        id: project.id,
        name: project.name,
        project_type: project.projectType,
        project_target_type: project.projectTargetBasedType,
        creation_date: project.creationDate,
      }));
  });
}

function listBranches(args: ListBranchesArguments, context: ToolContext) {
  return context.list(AieToolName.ListBranches, { project_id: args.project_id }, args, () => {
    const { api } = context.session;

    return api.json(api.projects.apiProjectsProjectIdBranchesGetRaw({ projectId: args.project_id }));
  });
}

async function listScans(args: ListScansArguments, context: ToolContext) {
  await context.findings.branch(args.project_id, args.branch_id);
  const { api } = context.session;

  return context.list(
    AieToolName.ListScans,
    {
      project_id: args.project_id,
      branch_id: args.branch_id,
      state: args.state,
      label: args.label,
      order: args.order,
    },
    args,
    async () => {
      const scans = await api.json(api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId: args.branch_id }));

      return scans
        .filter(
          (scan) =>
            (!args.state?.length || args.state.includes(normalizeScanState(scan.progress?.stage ?? 'Unknown'))) &&
            (!args.label || scan.scanLabel === args.label),
        )
        .sort(
          (a, b) =>
            (args.order === ScanOrder.Ascending ? 1 : -1) *
            String(a.scanDate ?? a.queueDate ?? '').localeCompare(String(b.scanDate ?? b.queueDate ?? '')),
        )
        .map((scan) => ({
          id: scan.id,
          project_id: scan.projectId,
          branch_id: scan.branchId,
          scan_date: scan.scanDate,
          queue_date: scan.queueDate,
          progress: scan.progress,
          statistics: scan.statistic,
          scan_type: scan.scanType,
          label: scan.scanLabel,
          has_errors: scan.hasErrors,
          previous_scan_id: scan.previousScanResultId,
        }));
    },
  );
}

function listScanAgents(args: ListScanAgentsArguments, context: ToolContext) {
  return context.list(AieToolName.ListScanAgents, { id: args.id }, args, async () => {
    const { api } = context.session;

    if (args.id) {
      return [await api.json(api.agents.getRaw({ agentId: args.id }))];
    }

    return api.json(api.agents.getAllRaw());
  });
}

type ProjectToolNames =
  | typeof AieToolName.ListProjects
  | typeof AieToolName.ListBranches
  | typeof AieToolName.ListScans
  | typeof AieToolName.ListScanAgents;

type ListProjectsArguments = ToolArguments[typeof AieToolName.ListProjects];
type ListBranchesArguments = ToolArguments[typeof AieToolName.ListBranches];
type ListScansArguments = ToolArguments[typeof AieToolName.ListScans];
type ListScanAgentsArguments = ToolArguments[typeof AieToolName.ListScanAgents];
