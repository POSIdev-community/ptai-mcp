import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { result } from '../../mcp/result.js';
import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { safeError, ToolError } from '../../shared/errors.js';
import type { JsonObject } from '../../shared/json.js';
import { LIMITS } from '../../shared/limits.js';
import { Outcome, TelemetryAction } from '../../telemetry/constants.js';
import { createTelemetry } from '../../telemetry/telemetry.js';
import { type Telemetry } from '../../telemetry/types.js';
import { type ConnectedSession } from '../auth/models.js';
import { Sessions } from '../auth/session.js';
import { PmCatalog } from '../pm/catalog.js';
import { Findings } from '../projects/findings.js';
import { beforeDeadline } from '../runtime/deadline.js';
import { JobState } from '../runtime/models.js';
import { Operations } from '../runtime/operations.js';
import { Pages } from '../runtime/pagination.js';
import { Scans } from '../scans/scan-service.js';
import type { RunTracker, ScanStatus } from '../scans/scan-status.js';
import { Settings } from '../settings/project-settings.js';
import { Sources } from '../sources/source-service.js';
import { AieToolName } from '../tool-names.js';
import { aieCatalog } from './catalog.js';
import type { ToolContext } from './context.js';
import { invokeHandler } from './handlers.js';
import { type ConnectedToolCall, type ToolCall } from './tool-contract.js';
import { parseToolCall } from './validation.js';

const definitions = new Map(aieCatalog.map((tool) => [tool.name, tool]));
const synchronousActions = new Set<string>([
  AieToolName.TriageIssue,
  AieToolName.UpdateProjectSettings,
  AieToolName.SavePmCatalogEntry,
  AieToolName.CancelOperation,
]);

export class AieDispatcher {

  public readonly operations: Operations;
  public readonly pages = new Pages();
  public readonly sessions: Sessions;

  private readonly runs: RunTracker = new Map();
  private readonly busy = new Set<string>();
  private readonly terminalScans = new Set<string>();

  public constructor(
    sessions?: Sessions,
    private readonly telemetry: Telemetry = createTelemetry(),
  ) {
    this.operations = new Operations((operation, state) =>
      this.action(operation, workflowOutcome(state), this.sessions.currentVersion),
    );
    this.sessions =
      sessions ??
      new Sessions(undefined, undefined, (identity) => {
        this.operations.cancelIdentity(identity);
        this.pages.clear();
        this.runs.clear();
      });
    this.sessions.onAction = (action, outcome, version) => this.action(action, outcome, version);
  }

  public async call(name: string, args: JsonObject = {}): Promise<CallToolResult> {
    const started = performance.now();
    let response: CallToolResult;

    try {
      const command = parseToolCall(name, args);
      const value = await this.run(command);
      response = result(value);
      this.recordSynchronousAction(command.name, value);
    } catch (error) {
      response = result({ error: safeError(error, name) }, true);
    }

    try {
      this.telemetry.invocation(name, response, performance.now() - started, args, this.sessions.currentVersion);
    } catch {
      // Metrics never change a tool response.
    }

    return response;
  }

  public async close() {
    this.sessions.close();
    await this.operations.close();
    this.pages.clear();
    await this.telemetry.close().catch(() => undefined);
  }

  private async run(call: ToolCall): Promise<JsonObject> {
    if (call.name === AieToolName.Auth) {
      return this.sessions.auth(call.args);
    }

    if (call.name === AieToolName.GetContext) {
      return this.sessions.context(call.args.login_id);
    }

    const deadline = Date.now() + LIMITS.scanStartMs;
    const local =
      (call.name === AieToolName.GetOperation || call.name === AieToolName.CancelOperation) && !!call.args.operation_id;

    const pending = local ? this.sessions.local() : this.sessions.require();
    const session = call.name === AieToolName.StartScan ? await beforeDeadline(pending, deadline) : await pending;
    const target = targetFor(call);
    const changing = !definitions.get(call.name)?.annotations?.readOnlyHint;
    const key = session.identity + ':' + target;

    if (changing && (this.busy.has(key) || this.operations.isBusy(session.identity, target))) {
      throw new ToolError(ErrorCode.TargetBusy, 'Another change is active for this target.', {
        effects: Effects.NotApplied,
      });
    }

    if (changing) {
      this.busy.add(key);
    }

    try {
      return await invokeHandler(call, this.context(session, target, deadline));
    } finally {
      if (changing) {
        this.busy.delete(key);
      }
    }
  }

  private context(session: ConnectedSession, target: string, deadline: number): ToolContext {
    return {
      session,
      operations: this.operations,
      pages: this.pages,
      findings: new Findings(session.api),
      settings: new Settings(session.api),
      pm: new PmCatalog(session.api),
      scans: new Scans(session.api, this.runs),
      sources: new Sources(session.api),
      runs: this.runs,
      deadline,
      requireRemote: () => this.sessions.require(),
      list: (name, query, page, load) => this.pages.list(session.identity, name, query, page, load),
      startOperation: (name, run) =>
        this.operations.start(session.identity, name, target, async (job) => {
          await this.sessions.assertIdentity(session.identity);

          return run(job);
        }),
      observeScan: (status) => this.observeScan(session, status),
    };
  }

  private observeScan(session: ConnectedSession, status: ScanStatus): void {
    if (!status.terminal || status.scan_id === null) {
      return;
    }

    const key = session.identity + ':' + status.scan_id;

    if (this.terminalScans.has(key)) {
      return;
    }

    this.terminalScans.add(key);

    if (this.terminalScans.size > LIMITS.maxTrackedRuns) {
      const oldest = this.terminalScans.values().next().value;

      if (oldest !== undefined) {
        this.terminalScans.delete(oldest);
      }
    }

    this.action(TelemetryAction.ScanTerminal, status.state, session.version);
  }

  private recordSynchronousAction(name: AieToolName, value: JsonObject): void {
    if (name === AieToolName.CancelOperation && !value.stop_requested) {
      return;
    }

    if (!synchronousActions.has(name) || value.effects !== Effects.Applied) {
      return;
    }

    const outcome = value.stop_requested || value.verified === false ? Outcome.Accepted : Effects.Applied;
    this.action(name, outcome, this.sessions.currentVersion);
  }

  private action(action: string, outcome: string, version?: string): void {
    try {
      this.telemetry.action(action, outcome, version);
    } catch {
      // Metrics cannot change workflow or authentication results.
    }
  }
}

function targetFor(call: ConnectedToolCall): string {
  const { args } = call;

  switch (call.name) {
    case AieToolName.CancelOperation:
      return 'operation:' + (call.args.operation_id ?? call.args.scan_id);
    case AieToolName.DownloadProject:
      return 'download:' + call.args.destination;
  }

  if ('project_id' in args) {
    return 'project:' + args.project_id;
  }

  if ('kind' in args) {
    return 'pm:' + args.kind;
  }

  return 'create-project';
}

function workflowOutcome(state: string): string {
  switch (state) {
    case JobState.Succeeded:
      return Effects.Applied;
    case JobState.Cancelled:
      return JobState.Cancelled;
    default:
      return Outcome.Error;
  }
}
