import { JobState } from '../aie/runtime/models.js';
import { Effects } from '../shared/effects.js';

export const UNKNOWN_TOOL = 'unknown';
export const MetricErrorCode = { None: 'NONE', Other: 'OTHER' } as const;
export const TelemetryAction = { ScanTerminal: 'scan_terminal' } as const;
export const MetricName = {
  Invocations: 'ptai.mcp.aie.tool.invocations',
  Duration: 'ptai.mcp.aie.tool.duration',
  Actions: 'ptai.mcp.aie.actions',
} as const;
export const Outcome = {
  Success: 'success',
  Error: 'error',
  Accepted: 'accepted',
  Applied: Effects.Applied,
  Partial: Effects.Partial,
  Unknown: Effects.Unknown,
  Cancelled: JobState.Cancelled,
} as const;
