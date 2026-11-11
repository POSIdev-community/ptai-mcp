import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError } from '../../shared/errors.js';
import type { AieApi } from '../api/client.js';
import type { VulnerabilityModel } from '../api/contracts.js';
import { checkReadback } from '../api/write-schema.js';
import { type IssueFilters, SourceMatch } from './models.js';

export class Findings {

  public constructor(public readonly api: AieApi) {}

  public async branch(projectId: string, branchId: string) {
    const parent = await this.api.json(this.api.branches.apiBranchesBranchIdProjectIdGetRaw({ branchId }));

    if (parent !== projectId) {
      throw new ToolError(ErrorCode.TargetMismatch, 'Selected branch does not belong to the project.', {
        effects: Effects.NotApplied,
      });
    }
  }

  public async scan(projectId: string, scanId: string, branchId?: string) {
    const scan = await this.api.json(
      this.api.projects.apiProjectsProjectIdScanResultsScanResultIdGetRaw({ projectId, scanResultId: scanId }),
    );

    if (scan.id !== scanId || scan.projectId !== projectId || (branchId && scan.branchId !== branchId)) {
      throw new ToolError(ErrorCode.TargetMismatch, 'Selected scan does not match the project/branch.', {
        effects: Effects.NotApplied,
      });
    }

    return scan;
  }

  public async list(projectId: string, scanId: string, filters: IssueFilters, branchId?: string) {
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

  public async details(projectId: string, scanId: string, issueId: string, branchId?: string) {
    const scan = await this.scan(projectId, scanId, branchId);
    const issue = await this.api.json(
      this.api.projects.apiProjectsProjectIdIssuesIssueIdGetRaw({ projectId, issueId }),
    );

    if (issue.id !== issueId || issue.scanResultId !== scanId) {
      throw new ToolError(ErrorCode.TargetMismatch, 'The issue does not belong to the selected scan.', {
        effects: Effects.NotApplied,
      });
    }

    return {
      project_id: projectId,
      branch_id: scan.branchId,
      scan_id: scanId,
      issue_id: issueId,
      issue,
      source_revision: 'historical_scan',
      local_source_match: SourceMatch.Unknown,
      completeness: 'all_fields_available_from_AIE_full_issue_endpoint',
    };
  }

  public async triage(
    projectId: string,
    scanId: string,
    issueId: string,
    state: 'Approval' | 'Discard' | 'None',
    comment: string,
    branchId?: string,
  ) {
    const before = await this.details(projectId, scanId, issueId, branchId);

    if (!before.branch_id) {
      throw new ToolError(ErrorCode.InvalidResponse, 'Issue branch is required to confirm its triage comment.');
    }

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
      await this.verifyTriageComment(before.branch_id, issueId, comment);

      return {
        project_id: projectId,
        scan_id: scanId,
        issue_id: issueId,
        state,
        comment,
        verified: true,
        effects: Effects.Applied,
        comment_readback: 'branch_history',
      };
    } catch (error) {
      if (error instanceof ToolError && error.code === ErrorCode.ReadbackMismatch) {
        throw error;
      }

      throw new ToolError(
        ErrorCode.ReadbackUnavailable,
        'Triage was accepted but state/comment readback could not be completed.',
        { effects: Effects.Applied, target: { project_id: projectId, scan_id: scanId, issue_id: issueId } },
      );
    }
  }

  private async verifyTriageComment(branchId: string, issueId: string, comment: string): Promise<void> {
    const history = await this.api.json(
      this.api.history.apiHistoryBranchesBranchIdGetRaw({ branchId: branchId, entityId: issueId }),
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
