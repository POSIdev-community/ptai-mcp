import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { safeError, ToolError, validation } from '../../shared/errors.js';
import { LIMITS } from '../../shared/limits.js';
import type { AieApi } from '../api/client.js';
import { ApiErrorType, type ScanResultModel, Stage } from '../api/contracts.js';
import { Findings } from '../projects/findings.js';
import { type JobContext, WorkflowStage } from '../runtime/models.js';
import type { Pages } from '../runtime/pagination.js';
import { sourcesReady } from '../sources/source-reader.js';
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
    return sourcesReady(this.api, projectId, branchId);
  }

  public async start(
    projectId: string,
    branchId: string,
    scope: 'Full' | 'Incremental',
    label: string | undefined,
    job: JobContext,
    initiatorId?: string,
  ) {
    job.stage(WorkflowStage.CheckingSources);
    const readiness = await this.sourcesReady(projectId, branchId);
    job.check();
    const before = await this.api.json(this.api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId }));
    job.stage(WorkflowStage.QueueingScan);
    const acceptedAt = new Date().toISOString();
    const scanLabel = label ? `MCP-${label}` : 'MCP';
    job.remember?.({ project_id: projectId, branch_id: branchId, scan_label: scanLabel });
    const queueId = await this.api.json(
      this.api.queue.createItemRaw({ createQueueItem: { branchId, scope, scanLabel } }),
    );

    if (!queueId) {
      throw new ToolError(ErrorCode.InvalidResponse, 'Scan start did not return a queue ID.', {
        effects: Effects.Unknown,
      });
    }

    job.applied(WorkflowStage.ScanQueued, { project_id: projectId, branch_id: branchId, queue_id: queueId });
    this.track(queueId, {
      projectId,
      branchId,
      queueId,
      before: before.flatMap((scan) => (scan.id ? [scan.id] : [])),
      acceptedAt,
      label: scanLabel,
      initiatorId,
    });

    const status = await this.resolveStart(projectId, branchId, queueId, job);

    return {
      queue_id: queueId,
      requested_scope: scope,
      actual_scope: 'pending_server_result',
      scan_label: scanLabel,
      accepted_at: acceptedAt,
      effects: Effects.Applied,
      accepted: true,
      source_readiness: readiness.source_readiness,
      source_directory_verified: readiness.source_directory_verified,
      poll_tool: AieToolName.GetOperation,
      ...status,
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
    requireExactStop(status);

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
        next_action: 'Poll this scan with aie_get_operation to confirm Aborted.',
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

  private track(queueId: string, run: TrackedRun) {
    this.runs.set(queueId, run);

    if (this.runs.size > LIMITS.maxTrackedRuns) {
      const oldest = this.runs.keys().next().value;

      if (oldest !== undefined) {
        this.runs.delete(oldest);
      }
    }
  }

  private async readQueue(target: ScanTarget, queueId: string): Promise<ScanStatus> {
    const tracked = this.runs.get(queueId);

    if (tracked) {
      validateTarget(target, tracked);
    }

    if (tracked?.scanId) {
      return {
        ...(await this.readScan(target, tracked.scanId)),
        queue_id: queueId,
        correlation: tracked.correlation ?? ScanCorrelation.Queue,
      };
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
        tracked.correlation = ScanCorrelation.Queue;
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
    const matching = await this.findHistoryCandidates(target.branchId, tracked, error);

    if (tracked?.label && matching.length === 1) {
      return this.inferScanFromHistory(target, queueId, tracked, matching[0].id);
    }

    const candidates = matching.map((scan) => ({
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

  private async findHistoryCandidates(
    branchId: string,
    tracked: TrackedRun | undefined,
    error: ToolError,
  ): Promise<IdentifiedScan[]> {
    if (!tracked) {
      return [];
    }

    const latest = await this.api
      .json(this.api.branches.apiBranchesBranchIdScanResultsLastGetRaw({ branchId }))
      .catch(() => undefined);

    if (error.details.server_code === ApiErrorType.EmptyScanResult) {
      return [];
    }

    if (latest?.id && tracked.before.includes(latest.id)) {
      return [];
    }

    const scans = await this.api.json(this.api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId }));

    return scans.filter((scan): scan is IdentifiedScan => isHistoryCandidate(scan, tracked));
  }

  private async inferScanFromHistory(target: ScanTarget, queueId: string, tracked: TrackedRun, scanId: string) {
    tracked.scanId = scanId;
    tracked.correlation = ScanCorrelation.History;

    return {
      ...(await this.readScan(target, scanId)),
      queue_id: queueId,
      correlation: ScanCorrelation.History,
      correlation_note: 'Inferred from new branch history; not an exact queue mapping.',
    };
  }

  private async resolveStart(projectId: string, branchId: string, queueId: string, job: JobContext) {
    try {
      while (true) {
        job.check();
        const status = await this.status(projectId, branchId, queueId);

        if (!status.scan_id) {
          await new Promise((resolve) => setTimeout(resolve, LIMITS.pollMs));
          job.check();
          continue;
        }

        job.remember?.({ scan_id: status.scan_id, correlation: status.correlation });

        if (job.cancellationRequested?.() && status.correlation === ScanCorrelation.Queue) {
          return { ...status, ...(await this.stopDeferred(projectId, branchId, queueId)) };
        }

        if (job.cancellationRequested?.()) {
          return {
            ...status,
            cancellation_pending: true,
            requires_explicit_scan_id: true,
            stop_requested: false,
            stop_confirmed: false,
            next_action:
              'Select this scan_id explicitly in aie_cancel_operation; history correlation cannot authorize automatic stop.',
          };
        }

        return status;
      }
    } catch (error) {
      return {
        project_id: projectId,
        branch_id: branchId,
        queue_id: queueId,
        scan_id: null,
        correlation: ScanCorrelation.Unconfirmed,
        state: ScanState.Unknown,
        refresh_error: safeError(error, 'resolve_scan'),
        next_action: 'Read aie_get_operation; do not repeat enqueue.',
      };
    }
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

  private async stopDeferred(projectId: string, branchId: string, queueId: string) {
    try {
      const stopped = await this.stop(projectId, branchId, queueId);

      return { stop_result: stopped, cancellation_pending: stopped.stop_requested && !stopped.stop_confirmed };
    } catch (error) {
      const failure = safeError(error, AieToolName.CancelOperation);
      const unknown = !(error instanceof ToolError) || error.details.effects === Effects.Unknown;

      return {
        cancellation_pending: true,
        stop_result: {
          stop_requested: unknown ? null : false,
          stop_confirmed: false,
          effects: failure.effects ?? Effects.Unknown,
          error: failure,
          next_action:
            'Read this scan with aie_get_operation to establish whether it stopped before retrying cancellation.',
        },
      };
    }
  }
}

function isHistoryCandidate(scan: ScanResultModel, tracked: TrackedRun): scan is IdentifiedScan {
  if (!scan.id || tracked.before.includes(scan.id)) {
    return false;
  }

  if (tracked.label && scan.scanLabel !== tracked.label) {
    return false;
  }

  return !tracked.initiatorId || !scan.initiator?.id || scan.initiator.id === tracked.initiatorId;
}

function requireExactStop(status: ScanStatus) {
  if (status.correlation === ScanCorrelation.History) {
    throw new ToolError(
      ErrorCode.ScanCorrelationRequired,
      'History matching is inferred. Select an explicit scan_id to stop.',
      {
        effects: Effects.NotApplied,
        target: { project_id: status.project_id, branch_id: status.branch_id, scan_id: status.scan_id },
      },
    );
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
    error.details.server_code === ApiErrorType.EmptyScanResult ||
    error.details.server_code === ApiErrorType.QueueItemAlreadyAssignedToAgent
  );
}

type IdentifiedScan = ScanResultModel & { id: string };
