import { AieToolName } from '../../tool-names.js';
import { type ToolHandlers } from '../handler-contract.js';

export const projectHandlers: Pick<ToolHandlers, Names> = {
  [AieToolName.ListProjects]: (args, context) =>
    context.list(AieToolName.ListProjects, { name: args.name }, args, async () => {
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
    }),
  [AieToolName.ListBranches]: (args, context) =>
    context.list(AieToolName.ListBranches, { project_id: args.project_id }, args, () => {
      const { api } = context.session;

      return api.json(api.projects.apiProjectsProjectIdBranchesGetRaw({ projectId: args.project_id }));
    }),
  [AieToolName.ListScans]: async (args, context) => {
    await context.findings.branch(args.project_id, args.branch_id);
    const { api } = context.session;

    return context.list(
      AieToolName.ListScans,
      { project_id: args.project_id, branch_id: args.branch_id },
      args,
      async () => {
        const scans = await api.json(api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId: args.branch_id }));

        return scans.map((scan) => ({
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
  },
  [AieToolName.ListScanAgents]: (args, context) =>
    context.list(AieToolName.ListScanAgents, { id: args.id }, args, async () => {
      const { api } = context.session;

      if (args.id) {
        return [await api.json(api.agents.getRaw({ agentId: args.id }))];
      }

      return api.json(api.agents.getAllRaw());
    }),
};

type Names =
  | typeof AieToolName.ListProjects
  | typeof AieToolName.ListBranches
  | typeof AieToolName.ListScans
  | typeof AieToolName.ListScanAgents;
