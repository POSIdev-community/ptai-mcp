import { ScanLaunchScope } from '../../api/contracts.js';
import { ScanState } from '../../scans/scan-status.js';
import { AieToolName } from '../../tool-names.js';
import { type ToolHandlers } from '../handler-contract.js';

export const scanHandlers: Pick<ToolHandlers, Names> = {
  [AieToolName.StartScan]: (args, context) =>
    context.startOperation(AieToolName.StartScan, (job) =>
      context.scans.start(args.project_id, args.branch_id, args.scope ?? ScanLaunchScope.Incremental, args.label, job),
    ),
  [AieToolName.GetScanStatus]: async (args, context) => {
    const status = await context.scans.status(args.project_id, args.branch_id, args.queue_id, args.scan_id);
    context.observeScan(status);
    const diagnostics = args.include_diagnostics ?? (status.state === ScanState.Failed || status.has_errors === true);

    if (!diagnostics || status.scan_id === null) {
      return { ...status, diagnostics: { requested: false } };
    }

    return {
      ...status,
      diagnostics: await context.scans.diagnostics(
        context.session.identity,
        args.project_id,
        status.scan_id,
        context.pages,
        args,
      ),
    };
  },
  [AieToolName.StopScan]: (args, context) =>
    context.scans.stop(args.project_id, args.branch_id, args.queue_id, args.scan_id),
};

type Names = typeof AieToolName.StartScan | typeof AieToolName.GetScanStatus | typeof AieToolName.StopScan;
