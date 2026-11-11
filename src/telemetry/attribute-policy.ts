import { AuthAction, SessionAction } from '../aie/auth/models.js';
import { PmAction, PmKind } from '../aie/pm/models.js';
import { ScanState } from '../aie/scans/scan-status.js';
import { SettingsSection } from '../aie/settings/models.js';
import { AieToolName } from '../aie/tool-names.js';
import { Effects } from '../shared/effects.js';
import { ErrorCode } from '../shared/error-codes.js';
import { Outcome, TelemetryAction } from './constants.js';

const tools: ReadonlySet<string> = new Set<AieToolName>(Object.values(AieToolName));
const actions: ReadonlySet<string> = new Set<RecordedAction>([
  ...Object.values(SessionAction),
  AieToolName.CreateProject,
  AieToolName.UploadSources,
  AieToolName.DownloadProject,
  AieToolName.StartScan,
  AieToolName.TriageIssue,
  AieToolName.UpdateProjectSettings,
  AieToolName.SavePmCatalogEntry,
  AieToolName.StopScan,
  TelemetryAction.ScanTerminal,
]);

const enums: Readonly<Record<string, ReadonlySet<string>>> = {
  action: new Set<AuthAction | PmAction>([...Object.values(AuthAction), ...Object.values(PmAction)]),
  section: new Set<SettingsSection>(Object.values(SettingsSection)),
  kind: new Set<PmKind>(Object.values(PmKind)),
};

const outcomes: ReadonlySet<string> = new Set<RecordedOutcome>([
  ...Object.values(Outcome),
  Effects.NotApplied,
  ScanState.Done,
  ScanState.Failed,
  ScanState.Stopped,
]);

const errors: ReadonlySet<string> = new Set<ErrorCode>([
  ErrorCode.ValidationError,
  ErrorCode.LoginRequired,
  ErrorCode.ServerRequired,
  ErrorCode.VersionUnsupported,
  ErrorCode.VersionUnknown,
  ErrorCode.TlsError,
  ErrorCode.NetworkError,
  ErrorCode.Timeout,
  ErrorCode.Cancelled,
  ErrorCode.PermissionDenied,
  ErrorCode.LicenseError,
  ErrorCode.NotFound,
  ErrorCode.Conflict,
  ErrorCode.RateLimited,
  ErrorCode.ServerError,
  ErrorCode.ContextChanged,
  ErrorCode.TargetMismatch,
  ErrorCode.TargetBusy,
  ErrorCode.OperationBusy,
  ErrorCode.OperationNotFound,
  ErrorCode.LoginNotFound,
  ErrorCode.SessionUnreadable,
  ErrorCode.SessionBusy,
  ErrorCode.RevisionConflict,
  ErrorCode.ReadbackMismatch,
  ErrorCode.ReadbackUnavailable,
  ErrorCode.InvalidResponse,
  ErrorCode.InvalidArchive,
  ErrorCode.ResultLimit,
  ErrorCode.UpstreamLimit,
  ErrorCode.ListLimit,
  ErrorCode.CursorInvalid,
  ErrorCode.ArchiveLimit,
  ErrorCode.InternalError,
  ErrorCode.SourcesNotReady,
  ErrorCode.SourceChanged,
  ErrorCode.SourceReadinessUnknown,
  ErrorCode.ScanCorrelationRequired,
  ErrorCode.CredentialsPreservationRequired,
]);

export function isKnownTool(name: string): boolean {
  return tools.has(name);
}

export function isKnownAction(name: string): boolean {
  return actions.has(name);
}

export function isKnownOutcome(value: string): boolean {
  return outcomes.has(value);
}

export function isKnownErrorCode(code: string): boolean {
  return errors.has(code);
}

export function allowedEnumAttributes(args: Readonly<Record<string, unknown>>): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const [key, allowed] of Object.entries(enums)) {
    const value = args[key];

    if (typeof value === 'string' && allowed.has(value)) {
      attributes[key] = value;
    }
  }

  return attributes;
}

type RecordedAction = SessionAction | AieToolName | (typeof TelemetryAction)[keyof typeof TelemetryAction];
type RecordedOutcome = Effects | ScanState | (typeof Outcome)[keyof typeof Outcome];
