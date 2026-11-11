import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { safeError, ToolError, validation } from '../../shared/errors.js';
import { LIMITS } from '../../shared/limits.js';
import type { AieApi } from '../api/client.js';
import { ApiErrorType, Stage } from '../api/contracts.js';
import { Findings } from '../projects/findings.js';
import { type JobContext, WorkflowStage } from '../runtime/models.js';
import type { Pages } from '../runtime/pagination.js';
import { AieToolName } from '../tool-names.js';
import {
  EMPTY_UUID,
  isTerminalScan,
  normalizeScanState,
  type ResolvedScanStatus,
  RunKind,
  type RunTracker,
  SCAN_MESSAGES_CURSOR,
  ScanCorrelation,
  ScanState,
  type ScanStatus,
  type ScanTarget,
  type SelectedRun,
  type TrackedRun,
} from './scan-status.js';

export class Scans {

  private readonly findings: Findings;

  public constructor(
    private readonly api: AieApi,
    private readonly runs: RunTracker,
  ) {
    this.findings = new Findings(api);
  }

  public async sourcesReady(projectId: string, branchId: string) {
    await this.findings.branch(projectId, branchId);
    const branch = await this.api.json(this.api.branches.apiBranchesBranchIdGetRaw({ branchId }));
    const date = Date.parse(branch.sourcesChangingDate ?? '');

    if (!Number.isFinite(date) || date <= 0) {
      throw new ToolError(ErrorCode.SourcesNotReady, 'The branch does not have confirmed uploaded sources.', {
        effects: Effects.NotApplied,
        next_action: 'Upload sources and verify source readiness before starting analysis.',
      });
    }

    return branch;
  }

  public async start(
    projectId: string,
    branchId: string,
    scope: 'Full' | 'Incremental',
    label: string | undefined,
    job: JobContext,
  ) {
    job.stage(WorkflowStage.CheckingSources);
    await this.sourcesReady(projectId, branchId);
    job.check();
    const before = await this.api.json(this.api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId }));
    job.stage(WorkflowStage.QueueingScan);
    const acceptedAt = new Date().toISOString();
    const queueId = await this.api.json(
      this.api.queue.createItemRaw({ createQueueItem: { branchId, scope, scanLabel: label } }, { signal: job.signal }),
    );

    if (!queueId) {
      throw new ToolError(ErrorCode.InvalidResponse, 'Scan start did not return a queue ID.', {
        effects: Effects.Unknown,
      });
    }

    job.applied(WorkflowStage.ScanQueued, { project_id: projectId, branch_id: branchId, queue_id: queueId });
    this.runs.set(queueId, {
      projectId,
      branchId,
      queueId,
      before: before.flatMap((scan) => (scan.id ? [scan.id] : [])),
      acceptedAt,
    });

    if (this.runs.size > LIMITS.maxTrackedRuns) {
      const oldest = this.runs.keys().next().value;

      if (oldest !== undefined) {
        this.runs.delete(oldest);
      }
    }

    return {
      project_id: projectId,
      branch_id: branchId,
      queue_id: queueId,
      requested_scope: scope,
      actual_scope: 'pending_server_result',
      label,
      accepted_at: acceptedAt,
      effects: Effects.Applied,
      accepted: true,
      poll_tool: AieToolName.GetScanStatus,
    };
  }

  public async status(projectId: string, branchId: string, queueId?: string, scanId?: string): Promise<ScanStatus> {
    const selected = selectRun(queueId, scanId);
    await this.findings.branch(projectId, branchId);
    const target = { projectId, branchId };

    if (selected.kind === RunKind.Scan) {
      return this.readScan(target, selected.id);
    }

    return this.readQueue(target, selected.id);
  }

  public async diagnostics(
    identity: string,
    projectId: string,
    scanId: string,
    pages: Pages,
    request: { cursor?: string; page_size?: number },
  ) {
    try {
      const data = await pages.list(
        identity,
        SCAN_MESSAGES_CURSOR,
        { project_id: projectId, scan_id: scanId },
        request,
        () =>
          this.api.json(
            this.api.projects.apiProjectsProjectIdScanResultsScanResultIdErrorsGetRaw({
              projectId,
              scanResultId: scanId,
            }),
          ),
      );

      return { available: true, ...data };
    } catch (error) {
      return { available: false, error: safeError(error, 'read_scan_diagnostics') };
    }
  }

  public async stop(projectId: string, branchId: string, queueId?: string, scanId?: string) {
    const status = await this.status(projectId, branchId, queueId, scanId);

    if (status.scan_id !== null) {
      if (status.terminal) {
        return {
          ...status,
          stop_requested: false,
          stop_confirmed: status.state === ScanState.Stopped,
          reason: 'already_terminal',
          effects: Effects.NotApplied,
        };
      }

      await this.api.empty(this.api.queue.stopScanRaw({ scanResultId: status.scan_id }));

      return {
        project_id: projectId,
        branch_id: branchId,
        scan_id: status.scan_id,
        queue_id: queueId,
        stop_requested: true,
        stop_confirmed: false,
        effects: Effects.Applied,
        next_action: 'Poll this scan with aie_get_scan_status to confirm Aborted.',
      };
    }

    if (status.state !== ScanState.Queued) {
      throw new ToolError(
        ErrorCode.ScanCorrelationRequired,
        'Queue-to-scan correlation is unknown. No stop request was sent.',
        {
          effects: Effects.NotApplied,
          target: { queue_id: queueId },
        },
      );
    }

    await this.api.empty(this.api.queue.deleteItemRaw({ itemId: status.queue_id }));

    return {
      project_id: projectId,
      branch_id: branchId,
      queue_id: status.queue_id,
      stop_requested: true,
      stop_confirmed: false,
      effects: Effects.Applied,
      next_action: 'Poll the selected queue/run. Queue disappearance alone does not prove cancellation.',
    };
  }

  private async readQueue(target: ScanTarget, queueId: string): Promise<ScanStatus> {
    const tracked = this.runs.get(queueId);

    if (tracked) {
      validateTarget(target, tracked);
    }

    if (tracked?.scanId) {
      return this.readScan(target, tracked.scanId);
    }

    try {
      return await this.readQueueItem(target, queueId, tracked);
    } catch (error) {
      if (!queueBecameUnavailable(error)) {
        throw error;
      }

      return this.unknownQueue(target, queueId, tracked, error);
    }
  }

  private async readQueueItem(
    target: ScanTarget,
    queueId: string,
    tracked: TrackedRun | undefined,
  ): Promise<ScanStatus> {
    const queued = await this.api.json(this.api.queue.getItemRaw({ itemId: queueId }));
    validateTarget(target, queued.scanObject);

    if (queued.scanResultId && queued.scanResultId !== EMPTY_UUID) {
      if (tracked) {
        tracked.scanId = queued.scanResultId;
      }

      return {
        ...(await this.readScan(target, queued.scanResultId)),
        queue_id: queueId,
        correlation: ScanCorrelation.Queue,
      };
    }

    return {
      project_id: target.projectId,
      branch_id: target.branchId,
      queue_id: queueId,
      scan_id: null,
      state: ScanState.Queued,
      stage: Stage.Enqueued,
      queue: queued,
      correlation: ScanCorrelation.Queue,
    };
  }

  private async unknownQueue(target: ScanTarget, queueId: string, tracked: TrackedRun | undefined, error: ToolError) {
    const scans = tracked
      ? await this.api.json(this.api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId: target.branchId }))
      : [];

    const candidates = scans
      .filter((scan) => scan.id && !tracked?.before.includes(scan.id))
      .map((scan) => ({
        id: scan.id,
        scan_date: scan.scanDate,
        stage: scan.progress?.stage,
        queue_date: scan.queueDate,
      }));

    // Candidates never establish an exact relationship with a disappearing queue item.
    return {
      project_id: target.projectId,
      branch_id: target.branchId,
      queue_id: queueId,
      scan_id: null,
      state: ScanState.Unknown,
      correlation: ScanCorrelation.Unconfirmed,
      candidates,
      queue_read_error: safeError(error, 'read_queue').code,
      next_action:
        'Select a confirmed scan ID or inspect the queue. The latest external scan has not been attributed to this start.',
    };
  }

  private async readScan(target: ScanTarget, scanId: string): Promise<ResolvedScanStatus> {
    const scan = await this.findings.scan(target.projectId, scanId, target.branchId);
    const stage = scan.progress?.stage ?? Stage.Unknown;
    const state = normalizeScanState(stage);

    return {
      project_id: target.projectId,
      branch_id: target.branchId,
      scan_id: scanId,
      stage,
      state,
      terminal: isTerminalScan(state),
      progress: scan.progress,
      statistics: scan.statistic,
      statistics_delta: scan.statisticDelta,
      previous_scan_id: scan.previousScanResultId,
      has_errors: scan.hasErrors,
      actual_scope: scan.scanType,
      metadata: scan,
      correlation: ScanCorrelation.ExplicitScan,
    };
  }
}

function selectRun(queueId?: string, scanId?: string): SelectedRun {
  if (queueId && !scanId) {
    return { kind: RunKind.Queue, id: queueId };
  }

  if (scanId && !queueId) {
    return { kind: RunKind.Scan, id: scanId };
  }

  return validation('Supply exactly one queue_id or scan_id.');
}

function validateTarget(expected: ScanTarget, actual: ScanTarget): void {
  if (actual.projectId !== expected.projectId || actual.branchId !== expected.branchId) {
    throw new ToolError(ErrorCode.TargetMismatch, 'The queue item belongs to another target.');
  }
}

function queueBecameUnavailable(error: unknown): error is ToolError {
  if (!(error instanceof ToolError)) {
    return false;
  }

  return (
    error.code === ErrorCode.NotFound ||
    error.code === ErrorCode.PermissionDenied ||
    error.details.server_code === ApiErrorType.QueueItemAlreadyAssignedToAgent
  );
}
