import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { ToolError, validation } from '../../shared/errors.js';
import type { ChangeHistoryRowModel } from '../../vendor/aie-v63/src/models/index.js';
import type { AieApi } from '../api/client.js';
import { issueCard, matches, summarizeIssues } from './issue-query.js';
import { searchIssues } from './issue-search.js';
import { type IssueFilters, IssueView, SourceMatch } from './models.js';

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

  public async query(
    projectId: string,
    scanId: string,
    filters: IssueFilters,
    branchId?: string,
    view: IssueView = IssueView.Items,
  ) {
    if (filters.start_line && filters.end_line && filters.end_line < filters.start_line) {
      validation('end_line must not precede start_line.');
    }

    await this.scan(projectId, scanId, branchId);
    const issues = await this.api.json(
      this.api.projects.apiProjectsProjectIdScanResultsScanResultIdIssuesGetRaw({ projectId, scanResultId: scanId }),
    );

    const searched = await searchIssues(
      this.api,
      projectId,
      issues.filter((issue) => matches(issue, filters)),
      filters.type,
    );

    return {
      items: view === IssueView.Summary ? summarizeIssues(searched.issues) : searched.issues.map(issueCard),
      metadata: {
        view,
        matched_issues: searched.issues.length,
        search: searched.search,
        counts_scope: 'all_matching_findings_including_discarded_and_suppressed; unlike AIE vulnerability statistics',
      },
    };
  }

  public async list(projectId: string, scanId: string, filters: IssueFilters, branchId?: string) {
    return (await this.query(projectId, scanId, filters, branchId)).items;
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
      throw new ToolError(ErrorCode.InvalidResponse, 'Issue branch is required for comment readback.');
    }

    const changed = before.issue.approvalState !== state;
    const target = { project_id: projectId, scan_id: scanId, issue_id: issueId };

    if (!changed && !comment) {
      return { ...target, state, verified: true, no_op: true, effects: Effects.NotApplied };
    }

    const prior = comment ? await this.commentHistory(before.branch_id, issueId).catch(() => null) : null;
    await this.writeTriage(projectId, issueId, state, comment, changed);

    try {
      const saved = await this.details(projectId, scanId, issueId, before.branch_id);
      this.assertTriage(saved.issue.approvalState === state, 'state', target);

      if (comment) {
        await this.verifyComment(before.branch_id, issueId, comment, prior, target);
      }

      return {
        ...target,
        state,
        comment,
        verified: true,
        effects: Effects.Applied,
        comment_readback: comment ? 'branch_history' : 'not_requested',
        verification_scope: 'selected_issue_only',
        synchronization: 'AIE asynchronously synchronizes matching hashes to other branches; not verified here',
      };
    } catch (error) {
      if (
        error instanceof ToolError &&
        (error.code === ErrorCode.ReadbackMismatch || error.code === ErrorCode.ReadbackUnavailable)
      ) {
        throw error;
      }

      throw new ToolError(ErrorCode.ReadbackUnavailable, 'Triage accepted; state/comment readback unavailable.', {
        effects: Effects.Applied,
        target,
      });
    }
  }

  private async writeTriage(
    projectId: string,
    issueId: string,
    state: 'Approval' | 'Discard' | 'None',
    comment: string,
    changed: boolean,
  ) {
    if (!changed) {
      await this.api.empty(
        this.api.projects.apiProjectsProjectIdIssuesIssueIdCommentPutRaw({
          projectId,
          issueId,
          changeIssueCommentModel: { comment },
        }),
      );

      return;
    }

    await this.api.empty(
      this.api.projects.apiProjectsProjectIdIssuesIssueIdStatePutRaw({
        projectId,
        issueId,
        changeIssueApprovalStateModel: { state, comment },
      }),
    );
  }

  private async verifyComment(
    branchId: string,
    issueId: string,
    comment: string,
    prior: ChangeHistoryRowModel[] | null,
    target: Record<string, string>,
  ) {
    if (prior === null) {
      throw new ToolError(ErrorCode.ReadbackUnavailable, 'Comment comparison baseline is unavailable.', {
        effects: Effects.Applied,
        target,
        failed_check: 'comment',
      });
    }

    const rows = await this.commentHistory(branchId, issueId);
    const fresh = rows.some(
      (row) => row.comment === comment && !prior.some((old) => JSON.stringify(old) === JSON.stringify(row)),
    );

    this.assertTriage(fresh, 'comment', target);
  }

  private async commentHistory(branchId: string, issueId: string) {
    const rows = await this.api.json(
      this.api.history.apiHistoryBranchesBranchIdGetRaw({ branchId, entityId: issueId }),
    );

    return rows.filter(
      (row) =>
        row.relatedEntityId === issueId && ['IssueApprovalState', 'Comment'].includes(row.changeObjectType ?? ''),
    );
  }

  private assertTriage(verified: boolean, failed_check: string, target: Record<string, string>) {
    if (!verified) {
      throw new ToolError(ErrorCode.ReadbackMismatch, 'Triage readback did not confirm the requested field.', {
        effects: Effects.Applied,
        target,
        failed_check,
      });
    }
  }
}

export { matches } from './issue-query.js';
