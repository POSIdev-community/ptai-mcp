import { Effects } from '../../../shared/effects.js';
import { ErrorCode } from '../../../shared/error-codes.js';
import { safeError, ToolError } from '../../../shared/errors.js';
import { ScanCorrelation, ScanState } from '../../scans/scan-status.js';
import { AieToolName } from '../../tool-names.js';
import type { ToolContext } from '../context.js';
import type { ToolHandlers } from '../handler-contract.js';
import type { OperationArguments, PageArguments, ToolArguments } from '../tool-contract.js';

export const operationHandlers: Pick<ToolHandlers, OperationToolNames> = {
  [AieToolName.GetOperation]: getOperation,
  [AieToolName.CancelOperation]: cancelOperation,
};

async function getOperation(args: GetOperationArguments, context: ToolContext) {
  if (!args.operation_id) {
    return readSelected(args, context);
  }

  const view = context.operations.get(context.session.identity, args.operation_id);
  const target = launchTarget(view);

  if (!target) {
    return view;
  }

  try {
    await requireSameRemote(context);
    const remote = await readScan(target, args, context);

    if (remote.scan_id) {
      context.operations.remember(context.session.identity, args.operation_id, {
        scan_id: remote.scan_id,
        correlation: remote.correlation,
      });
    }

    return { ...view, workflow_state: view.state, scan_state: remote.state, remote };
  } catch (error) {
    if (error instanceof ToolError && error.code === ErrorCode.ContextChanged) {
      throw error;
    }

    return { ...view, workflow_state: view.state, remote_refresh_error: safeError(error, AieToolName.GetOperation) };
  }
}

async function cancelOperation(args: OperationArguments, context: ToolContext) {
  if (!args.operation_id) {
    return context.scans.stop(args.project_id!, args.branch_id!, undefined, args.scan_id!);
  }

  const view = context.operations.cancel(context.session.identity, args.operation_id);
  const target = launchTarget(view);

  if (!target) {
    return view.operation === AieToolName.StartScan
      ? {
          ...view,
          cancellation_pending: true,
          stop_requested: false,
          stop_confirmed: false,
          next_action: 'Launch is not yet linked; inspect get_operation before selecting a scan to stop.',
        }
      : view;
  }

  try {
    await requireSameRemote(context);

    if (target.correlation === ScanCorrelation.History) {
      throw new ToolError(
        ErrorCode.ScanCorrelationRequired,
        'Select an explicit scan_id before stopping an inferred launch.',
        {
          effects: Effects.NotApplied,
          target: { scan_id: target.scanId },
        },
      );
    }

    const stopped = await context.scans.stop(target.projectId, target.branchId, target.queueId, target.scanId);

    return { ...view, ...stopped, workflow_state: view.state };
  } catch (error) {
    if (error instanceof ToolError && error.code === ErrorCode.ContextChanged) {
      throw error;
    }

    const unknown = error instanceof ToolError && error.details.effects === Effects.Unknown;

    return {
      ...view,
      effects: unknown ? Effects.Unknown : view.effects,
      stop_requested: unknown ? null : false,
      stop_confirmed: false,
      remote_error: safeError(error, AieToolName.CancelOperation),
      cancellation_pending: true,
    };
  }
}

async function requireSameRemote(context: ToolContext) {
  const current = await context.requireRemote();

  if (current.identity !== context.session.identity) {
    throw new ToolError(ErrorCode.ContextChanged, 'Server or user changed; operation access is refused.');
  }
}

async function readSelected(args: GetOperationArguments, context: ToolContext) {
  return readScan({ projectId: args.project_id!, branchId: args.branch_id!, scanId: args.scan_id! }, args, context);
}

async function readScan(
  target: RemoteTarget,
  args: PageArguments & { include_diagnostics?: boolean },
  context: ToolContext,
) {
  const observed = await context.scans.status(target.projectId, target.branchId, target.queueId, target.scanId);
  const status = observed.scan_id && target.correlation ? { ...observed, correlation: target.correlation } : observed;
  context.observeScan(status);
  const diagnostics = args.include_diagnostics ?? (status.state === ScanState.Failed || status.has_errors === true);

  if (!diagnostics || !status.scan_id) {
    return { ...status, diagnostics: { requested: false } };
  }

  return {
    ...status,
    diagnostics: await context.scans.diagnostics(
      context.session.identity,
      target.projectId,
      status.scan_id,
      context.pages,
      args,
    ),
  };
}

function launchTarget(view: ReturnType<ToolContext['operations']['get']>): RemoteTarget | null {
  const ids = view.known_ids;

  if (
    view.operation !== AieToolName.StartScan ||
    typeof ids.project_id !== 'string' ||
    typeof ids.branch_id !== 'string'
  ) {
    return null;
  }

  if (
    typeof ids.scan_id === 'string' &&
    (ids.correlation === ScanCorrelation.Queue || ids.correlation === ScanCorrelation.History)
  ) {
    return { projectId: ids.project_id, branchId: ids.branch_id, scanId: ids.scan_id, correlation: ids.correlation };
  }

  if (typeof ids.queue_id === 'string') {
    return { projectId: ids.project_id, branchId: ids.branch_id, queueId: ids.queue_id };
  }

  if (typeof ids.scan_id === 'string') {
    return { projectId: ids.project_id, branchId: ids.branch_id, scanId: ids.scan_id };
  }

  return null;
}

type RemoteTarget = {
  projectId: string;
  branchId: string;
  queueId?: string;
  scanId?: string;
  correlation?: typeof ScanCorrelation.Queue | typeof ScanCorrelation.History;
};

type OperationToolNames = typeof AieToolName.GetOperation | typeof AieToolName.CancelOperation;
type GetOperationArguments = ToolArguments[typeof AieToolName.GetOperation];
