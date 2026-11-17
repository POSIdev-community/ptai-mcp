import { Effects } from '../../../shared/effects.js';
import { ErrorCode } from '../../../shared/error-codes.js';
import { ToolError } from '../../../shared/errors.js';
import { ScanLaunchScope } from '../../api/contracts.js';
import { JobState, WorkflowStage } from '../../runtime/models.js';
import { Scans } from '../../scans/scan-service.js';
import { ScanCorrelation } from '../../scans/scan-status.js';
import { AieToolName } from '../../tool-names.js';
import type { ToolContext } from '../context.js';
import type { ToolHandlers } from '../handler-contract.js';
import type { ToolArguments } from '../tool-contract.js';

export const scanHandlers: Pick<ToolHandlers, ScanToolNames> = {
  [AieToolName.StartScan]: startScan,
};

async function startScan(args: StartScanArguments, context: ToolContext) {
  const signal = AbortSignal.timeout(Math.max(1, context.deadline - Date.now()));
  const scans = new Scans(context.session.api.scoped(signal), context.runs);
  const started = context.startOperation(AieToolName.StartScan, async (job) => {
    const scoped = {
      ...job,
      check: () => {
        job.check();
        signal.throwIfAborted();

        if (Date.now() >= context.deadline) {
          throw new ToolError(ErrorCode.Timeout, 'Launch wait budget elapsed.');
        }
      },
    };

    return scans.start(
      args.project_id,
      args.branch_id,
      args.scope ?? ScanLaunchScope.Incremental,
      args.label_suffix,
      scoped,
      context.session.user.id,
    );
  });

  const view = await context.operations.wait(
    context.session.identity,
    started.operation_id,
    Math.max(0, context.deadline - Date.now()),
  );

  return launchResponse(view);
}

function launchResponse(view: OperationView) {
  if (view.state === JobState.Failed && view.error) {
    throw new ToolError(view.error.code, view.error.message, {
      ...view.error,
      target: { operation_id: view.operation_id, ...view.known_ids },
    });
  }

  const uncertain = !view.known_ids.queue_id && view.stage === WorkflowStage.QueueingScan;

  return {
    ...view,
    ...view.result,
    workflow_state: view.state,
    operation_id: view.operation_id,
    effects: view.result?.effects ?? (uncertain ? Effects.Unknown : view.effects),
    ...(!view.result
      ? {
          ...view.known_ids,
          accepted: uncertain ? null : !!view.known_ids.queue_id,
          correlation: ScanCorrelation.Unconfirmed,
          next_action: 'Read aie_get_operation; do not repeat enqueue.',
        }
      : {}),
  };
}

type ScanToolNames = typeof AieToolName.StartScan;
type StartScanArguments = ToolArguments[typeof AieToolName.StartScan];
type OperationView = ReturnType<ToolContext['operations']['get']>;
