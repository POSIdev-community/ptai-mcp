import { type QueueItem, type ScanResultModel, Stage } from '../../vendor/aie-v63/src/models/index.js';

export const ScanState = {
  Queued: 'queued',
  Running: 'running',
  Done: 'done',
  Failed: 'failed',
  Stopped: 'stopped',
  Unknown: 'unknown',
} as const;
export type ScanState = (typeof ScanState)[keyof typeof ScanState];

export const ScanCorrelation = {
  Queue: 'queue_item',
  ExplicitScan: 'explicit_scan_id',
  Unconfirmed: 'unconfirmed',
} as const;

export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
export const RunKind = { Queue: 'queue', Scan: 'scan' } as const;
export const SCAN_MESSAGES_CURSOR = 'aie_scan_messages';

export interface ScanTarget {
  projectId: string;
  branchId: string;
}

export interface TrackedRun extends ScanTarget {
  queueId: string;
  scanId?: string;
  before: string[];
  acceptedAt: string;
}
export type RunTracker = Map<string, TrackedRun>;
export type SelectedRun = { kind: 'queue'; id: string } | { kind: 'scan'; id: string };

export interface QueuedStatus extends StatusBase {
  queue_id: string;
  scan_id: null;
  state: typeof ScanState.Queued;
  stage: typeof Stage.Enqueued;
  terminal?: false;
  queue: QueueItem;
  correlation: typeof ScanCorrelation.Queue;
}

export interface UnknownQueueStatus extends StatusBase {
  queue_id: string;
  scan_id: null;
  state: typeof ScanState.Unknown;
  terminal?: false;
  correlation: typeof ScanCorrelation.Unconfirmed;
  candidates: Array<{
    id?: string;
    scan_date: ScanResultModel['scanDate'];
    stage: string | undefined;
    queue_date: ScanResultModel['queueDate'];
  }>;
  queue_read_error: string;
  next_action: string;
}

export interface ResolvedScanStatus extends StatusBase {
  scan_id: string;
  queue_id?: string;
  stage: string;
  state: ScanState;
  terminal: boolean;
  progress: ScanResultModel['progress'];
  statistics: ScanResultModel['statistic'];
  statistics_delta: ScanResultModel['statisticDelta'];
  previous_scan_id: ScanResultModel['previousScanResultId'];
  actual_scope: ScanResultModel['scanType'];
  metadata: ScanResultModel;
  correlation: typeof ScanCorrelation.Queue | typeof ScanCorrelation.ExplicitScan;
}

export type ScanStatus = QueuedStatus | UnknownQueueStatus | ResolvedScanStatus;

const states = new Map<string, ScanState>([
  [Stage.Unknown, ScanState.Unknown],
  [Stage.Enqueued, ScanState.Queued],
  [Stage.VfsSetup, ScanState.Running],
  [Stage.Initialize, ScanState.Running],
  [Stage.Precheck, ScanState.Running],
  [Stage.Scan, ScanState.Running],
  [Stage.Finalize, ScanState.Running],
  [Stage.Autocheck, ScanState.Running],
  [Stage.Done, ScanState.Done],
  [Stage.Failed, ScanState.Failed],
  [Stage.Aborted, ScanState.Stopped],
]);

const terminalStates = new Set<ScanState>([ScanState.Done, ScanState.Failed, ScanState.Stopped]);

export function normalizeScanState(stage: string): ScanState {
  return states.get(stage) ?? ScanState.Unknown;
}

export function isTerminalScan(state: ScanState): boolean {
  return terminalStates.has(state);
}

interface StatusBase {
  project_id: string;
  branch_id: string;
  has_errors?: boolean;
}
