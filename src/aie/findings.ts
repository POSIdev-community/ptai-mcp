import type { AieApi } from './api.js';
import { AieError } from './errors.js';
import { checkReadback } from './schema.js';
import type { VulnerabilityModel } from '../vendor/aie-v63/src/models/index.js';

export interface IssueFilters {
  severity?: string[];
  approval_state?: string[];
  issue_type?: string[];
  is_new?: boolean;
  path?: string;
  counter?: number;
}

export class Findings {
  constructor(readonly api: AieApi) {}

  async branch(projectId: string, branchId: string) {
    const parent = await this.api.json(this.api.branches.apiBranchesBranchIdProjectIdGetRaw({ branchId }));
    if (parent !== projectId)
      throw new AieError('AIE_TARGET_MISMATCH', 'Selected branch does not belong to the project.', {
        effects: 'not_applied',
      });
  }

  async scan(projectId: string, scanId: string, branchId?: string) {
    const scan = await this.api.json(
      this.api.projects.apiProjectsProjectIdScanResultsScanResultIdGetRaw({ projectId, scanResultId: scanId }),
    );
    if (scan.id !== scanId || scan.projectId !== projectId || (branchId && scan.branchId !== branchId)) {
      throw new AieError('AIE_TARGET_MISMATCH', 'Selected scan does not match the project/branch.', {
        effects: 'not_applied',
      });
    }
    return scan;
  }

  async list(projectId: string, scanId: string, filters: IssueFilters, branchId?: string) {
    await this.scan(projectId, scanId, branchId);
    const issues = await this.api.json(
      this.api.projects.apiProjectsProjectIdScanResultsScanResultIdIssuesGetRaw({ projectId, scanResultId: scanId }),
    );
    return issues
      .filter((issue) => matches(issue, filters))
      .map((issue) => ({
        id: issue.id,
        counter: issue.counter,
        type: issue.type,
        issue_type: issue.issueType,
        severity: issue.level,
        approval_state: issue.approvalState,
        is_new: issue.isNew,
        scan_module: issue.scanModule,
        source_file: issue.sourceFile,
        source_begin_line: issue.sourceBeginLine,
        source_end_line: issue.sourceEndLine,
        source_begin_column: issue.sourceBeginColumn,
        source_end_column: issue.sourceEndColumn,
        entry_point_file: issue.entryPointFile,
        entry_point_line: issue.entryPointLine,
        component: issue.vulnerableComponent ?? issue.vulnerableScaComponent,
      }));
  }

  async details(projectId: string, scanId: string, issueId: string, branchId?: string) {
    const scan = await this.scan(projectId, scanId, branchId);
    const issue = await this.api.json(
      this.api.projects.apiProjectsProjectIdIssuesIssueIdGetRaw({ projectId, issueId }),
    );
    if (issue.id !== issueId || issue.scanResultId !== scanId)
      throw new AieError('AIE_TARGET_MISMATCH', 'The issue does not belong to the selected scan.', {
        effects: 'not_applied',
      });
    return {
      project_id: projectId,
      branch_id: scan.branchId,
      scan_id: scanId,
      issue_id: issueId,
      issue,
      source_revision: 'historical_scan',
      local_source_match: 'unknown',
      completeness: 'all_fields_available_from_AIE_full_issue_endpoint',
    };
  }

  async triage(
    projectId: string,
    scanId: string,
    issueId: string,
    state: 'Approval' | 'Discard' | 'None',
    comment: string,
    branchId?: string,
  ) {
    const before = await this.details(projectId, scanId, issueId, branchId);
    if (!before.branch_id)
      throw new AieError('AIE_INVALID_RESPONSE', 'Issue branch is required to confirm its triage comment.');
    await this.api.empty(
      this.api.projects.apiProjectsProjectIdIssuesIssueIdStatePutRaw({
        projectId,
        issueId,
        changeIssueApprovalStateModel: { state, comment },
      }),
    );
    try {
      const saved = await this.details(projectId, scanId, issueId, before.branch_id);
      checkReadback({ state: saved.issue.approvalState }, { state });
      const history = await this.api.json(
        this.api.history.apiHistoryBranchesBranchIdGetRaw({ branchId: before.branch_id, entityId: issueId }),
      );
      const newest = history
        .filter(
          (row) =>
            row.relatedEntityId === issueId && ['IssueApprovalState', 'Comment'].includes(row.changeObjectType ?? ''),
        )
        .sort(
          (a, b) => String(b.changedDateTime).localeCompare(String(a.changedDateTime)) || Number(b.id) - Number(a.id),
        )[0];
      checkReadback({ comment: newest?.comment }, { comment });
      return {
        project_id: projectId,
        scan_id: scanId,
        issue_id: issueId,
        state,
        comment,
        verified: true,
        effects: 'applied',
        comment_readback: 'branch_history',
      };
    } catch (error) {
      if (error instanceof AieError && error.code === 'AIE_READBACK_MISMATCH') throw error;
      throw new AieError(
        'AIE_READBACK_UNAVAILABLE',
        'Triage was accepted but state/comment readback could not be completed.',
        { effects: 'applied', target: { project_id: projectId, scan_id: scanId, issue_id: issueId } },
      );
    }
  }
}

export function matches(issue: VulnerabilityModel, filters: IssueFilters) {
  return (
    (!filters.severity?.length || filters.severity.includes(issue.level ?? '')) &&
    (!filters.approval_state?.length || filters.approval_state.includes(issue.approvalState ?? '')) &&
    (!filters.issue_type?.length || filters.issue_type.includes(issue.issueType ?? '')) &&
    (filters.is_new === undefined || issue.isNew === filters.is_new) &&
    (filters.counter === undefined || issue.counter === filters.counter) &&
    (!filters.path ||
      [issue.sourceFile, issue.entryPointFile].some((file) =>
        file?.replace(/\\/g, '/').toLowerCase().includes(filters.path!.replace(/\\/g, '/').toLowerCase()),
      ))
  );
}
