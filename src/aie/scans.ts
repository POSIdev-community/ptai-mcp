import type { AieApi } from './api.js';
import { Findings } from './findings.js';
import { AieError, safeError, validation } from './errors.js';
import type { JobContext } from './operations.js';
import type { Pages } from './pagination.js';

interface Run {
  projectId: string;
  branchId: string;
  queueId: string;
  scanId?: string;
  before: string[];
  acceptedAt: string;
}
export type RunTracker = Map<string, Run>;
const terminal = new Set(['Done', 'Failed', 'Aborted']);

export class Scans {
  constructor(
    private readonly api: AieApi,
    private readonly runs: RunTracker,
  ) {}

  async sourcesReady(projectId: string, branchId: string) {
    await new Findings(this.api).branch(projectId, branchId);
    const branch = await this.api.json(this.api.branches.apiBranchesBranchIdGetRaw({ branchId }));
    const date = Date.parse(branch.sourcesChangingDate ?? '');
    if (!Number.isFinite(date) || date <= 0)
      throw new AieError('AIE_SOURCES_NOT_READY', 'The branch does not have confirmed uploaded sources.', {
        effects: 'not_applied',
        next_action: 'Upload sources and verify source readiness before starting analysis.',
      });
    return branch;
  }

  async start(
    projectId: string,
    branchId: string,
    scope: 'Full' | 'Incremental',
    label: string | undefined,
    job: JobContext,
  ) {
    job.stage('checking_sources');
    await this.sourcesReady(projectId, branchId);
    job.check();
    const before = await this.api.json(this.api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId }));
    job.stage('queueing_scan');
    const acceptedAt = new Date().toISOString();
    const queueId = await this.api.json(
      this.api.queue.createItemRaw({ createQueueItem: { branchId, scope, scanLabel: label } }, { signal: job.signal }),
    );
    if (!queueId)
      throw new AieError('AIE_INVALID_RESPONSE', 'Scan start did not return a queue ID.', { effects: 'unknown' });
    job.applied('scan_queued', { project_id: projectId, branch_id: branchId, queue_id: queueId });
    const run: Run = {
      projectId,
      branchId,
      queueId,
      before: before.flatMap((scan) => (scan.id ? [scan.id] : [])),
      acceptedAt,
    };
    this.runs.set(queueId, run);
    if (this.runs.size > 1000) this.runs.delete(this.runs.keys().next().value!);
    return {
      project_id: projectId,
      branch_id: branchId,
      queue_id: queueId,
      requested_scope: scope,
      actual_scope: 'pending_server_result',
      label,
      accepted_at: acceptedAt,
      effects: 'applied',
      accepted: true,
      poll_tool: 'aie_get_scan_status',
    };
  }

  async status(
    projectId: string,
    branchId: string,
    queueId?: string,
    scanId?: string,
  ): Promise<Record<string, unknown>> {
    if (!!queueId === !!scanId) validation('Supply exactly one queue_id or scan_id.');
    const findings = new Findings(this.api);
    await findings.branch(projectId, branchId);
    if (queueId) {
      const tracked = this.runs.get(queueId);
      if (tracked && (tracked.projectId !== projectId || tracked.branchId !== branchId))
        throw new AieError('AIE_TARGET_MISMATCH', 'The queue item belongs to another target.');
      if (tracked?.scanId) return this.status(projectId, branchId, undefined, tracked.scanId);
      try {
        const queued = await this.api.json(this.api.queue.getItemRaw({ itemId: queueId }));
        if (queued.scanObject.projectId !== projectId || queued.scanObject.branchId !== branchId)
          throw new AieError('AIE_TARGET_MISMATCH', 'The queue item belongs to another target.');
        if (queued.scanResultId && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(queued.scanResultId)) {
          if (tracked) tracked.scanId = queued.scanResultId;
          return {
            ...(await this.status(projectId, branchId, undefined, queued.scanResultId)),
            queue_id: queueId,
            correlation: 'queue_item',
          };
        }
        return {
          project_id: projectId,
          branch_id: branchId,
          queue_id: queueId,
          state: 'queued',
          stage: 'Enqueued',
          queue: queued,
          correlation: 'queue_item',
          scan_id: null,
        };
      } catch (error) {
        if (
          !(error instanceof AieError) ||
          (!['AIE_NOT_FOUND', 'AIE_PERMISSION_DENIED'].includes(error.code) &&
            error.details.server_code !== 'QUEUE_ITEM_ALREADY_ASSIGNED_TO_AGENT')
        )
          throw error;
        // A disappearing queue item may have started, finished, failed, or been
        // removed. Never silently replace it with the branch's latest scan.
        const candidates = tracked
          ? (await this.api.json(this.api.branches.apiBranchesBranchIdScanResultsGetRaw({ branchId })))
              .filter((scan) => scan.id && !tracked.before.includes(scan.id))
              .map((scan) => ({
                id: scan.id,
                scan_date: scan.scanDate,
                stage: scan.progress?.stage,
                queue_date: scan.queueDate,
              }))
          : [];
        return {
          project_id: projectId,
          branch_id: branchId,
          queue_id: queueId,
          scan_id: null,
          state: 'unknown',
          correlation: 'unconfirmed',
          candidates,
          queue_read_error: safeError(error, 'read_queue').code,
          next_action:
            'Select a confirmed scan ID or inspect the queue. The latest external scan has not been attributed to this start.',
        };
      }
    }
    const scan = await findings.scan(projectId, scanId!, branchId);
    const stage = scan.progress?.stage ?? 'Unknown';
    const state =
      stage === 'Done'
        ? 'done'
        : stage === 'Failed'
          ? 'failed'
          : stage === 'Aborted'
            ? 'stopped'
            : stage === 'Enqueued'
              ? 'queued'
              : ['VFSSetup', 'Initialize', 'Precheck', 'Scan', 'Finalize', 'Autocheck'].includes(stage)
                ? 'running'
                : 'unknown';
    return {
      project_id: projectId,
      branch_id: branchId,
      scan_id: scanId,
      stage,
      state,
      terminal: terminal.has(stage),
      progress: scan.progress,
      statistics: scan.statistic,
      statistics_delta: scan.statisticDelta,
      previous_scan_id: scan.previousScanResultId,
      has_errors: scan.hasErrors,
      actual_scope: scan.scanType,
      metadata: scan,
      correlation: 'explicit_scan_id',
    };
  }

  async diagnostics(
    identity: string,
    projectId: string,
    scanId: string,
    pages: Pages,
    request: { cursor?: string; page_size?: number },
  ) {
    try {
      const data = await pages.list(
        identity,
        'aie_scan_messages',
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

  async stop(projectId: string, branchId: string, queueId?: string, scanId?: string) {
    const status = await this.status(projectId, branchId, queueId, scanId);
    const currentScanId = status.scan_id;
    if (typeof currentScanId === 'string') {
      if ('terminal' in status && status.terminal)
        return {
          ...status,
          stop_requested: false,
          stop_confirmed: status.state === 'stopped',
          reason: 'already_terminal',
          effects: 'not_applied',
        };
      await this.api.empty(this.api.queue.stopScanRaw({ scanResultId: currentScanId }));
      return {
        project_id: projectId,
        branch_id: branchId,
        scan_id: currentScanId,
        queue_id: queueId,
        stop_requested: true,
        stop_confirmed: false,
        effects: 'applied',
        next_action: 'Poll this scan with aie_get_scan_status to confirm Aborted.',
      };
    }
    if (status.state !== 'queued')
      throw new AieError(
        'AIE_SCAN_CORRELATION_REQUIRED',
        'Queue-to-scan correlation is unknown. No stop request was sent.',
        { effects: 'not_applied', target: { queue_id: queueId } },
      );
    await this.api.empty(this.api.queue.deleteItemRaw({ itemId: queueId! }));
    return {
      project_id: projectId,
      branch_id: branchId,
      queue_id: queueId,
      stop_requested: true,
      stop_confirmed: false,
      effects: 'applied',
      next_action: 'Poll the selected queue/run. Queue disappearance alone does not prove cancellation.',
    };
  }
}
