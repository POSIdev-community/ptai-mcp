import { randomUUID } from 'node:crypto';
import { Effects } from '../../shared/effects.js';
import { ErrorCode } from '../../shared/error-codes.js';
import { safeError, ToolError } from '../../shared/errors.js';
import { LIMITS } from '../../shared/limits.js';
import { type JobContext, JobState, WorkflowStage } from './models.js';

export class Operations {

  private readonly jobs = new Map<string, Job>();
  private closing = false;

  public constructor(private readonly onTerminal: (operation: string, state: JobState) => void = () => undefined) {}

  public start(
    identity: string,
    operation: string,
    target: string,
    run: (job: JobContext) => Promise<Record<string, unknown>>,
  ) {
    this.prune();
    const active = [...this.jobs.values()].filter((j) => !j.finished_at);

    if (this.closing || active.length >= LIMITS.maxActiveJobs) {
      throw new ToolError(ErrorCode.OperationBusy, 'No workflow slot is available.', { effects: Effects.NotApplied });
    }

    if (active.some((j) => j.identity === identity && j.target === target)) {
      throw new ToolError(ErrorCode.TargetBusy, 'A workflow is already changing this target.', {
        effects: Effects.NotApplied,
      });
    }

    const job = this.createJob(identity, operation, target);

    this.jobs.set(job.operation_id, job);

    this.execute(job, run);

    return this.view(job);
  }

  public get(identity: string, id: string) {
    this.prune();

    return this.view(this.find(identity, id));
  }

  public isBusy(identity: string, target: string) {
    return [...this.jobs.values()].some(
      (job) => job.identity === identity && job.target === target && !job.finished_at,
    );
  }

  public cancel(identity: string, id: string) {
    const job = this.find(identity, id);

    if (!job.finished_at) {
      job.state = JobState.Cancelling;
      job.controller.abort();
    }

    return this.view(job);
  }

  public cancelIdentity(identity: string) {
    for (const job of this.jobs.values()) {
      if (job.identity === identity && !job.finished_at) {
        job.state = JobState.Cancelling;
        job.controller.abort();
      }
    }
  }

  public async close() {
    this.closing = true;

    for (const job of this.jobs.values()) {
      if (!job.finished_at) {
        job.controller.abort();
      }
    }

    // No scan-stop or rollback is implied by shutting down this process.
    await Promise.race([
      Promise.allSettled([...this.jobs.values()].map((j) => j.task)),
      new Promise((resolve) => {
        const timer = setTimeout(resolve, 1000);
        timer.unref();
      }),
    ]);
  }

  private find(identity: string, id: string): Job {
    const job = this.jobs.get(id);

    if (!job) {
      throw new ToolError(
        ErrorCode.OperationNotFound,
        'Operation was lost after restart, expired, or does not exist. Inspect AIE using the known IDs before repeating a change.',
      );
    }

    if (job.identity !== identity) {
      throw new ToolError(ErrorCode.ContextChanged, 'Operation belongs to another server or user.');
    }

    return job;
  }

  private view(job: Job) {
    return {
      operation_id: job.operation_id,
      operation: job.operation,
      state: job.state,
      stage: job.stage,
      completed_stages: [...job.completed_stages],
      known_ids: { ...job.known_ids },
      effects: job.effects,
      result: job.result,
      error: job.error,
      poll_after_ms: job.finished_at ? null : LIMITS.pollMs,
      persistence: 'current_process_only',
    };
  }

  private prune() {
    const terminal = [...this.jobs.values()]
      .filter((j) => j.finished_at)
      .sort((a, b) => a.finished_at! - b.finished_at!);

    for (const [index, job] of terminal.entries()) {
      if (job.finished_at! + LIMITS.jobTtlMs <= Date.now() || index < terminal.length - LIMITS.maxTerminalJobs) {
        this.jobs.delete(job.operation_id);
      }
    }
  }

  private jobContext(job: Job): JobContext {
    const check = () => {
      if (job.controller.signal.aborted) {
        throw new ToolError(ErrorCode.Cancelled, 'Workflow cancelled.');
      }
    };

    const context: JobContext = {
      signal: job.controller.signal,
      check,
      stage: (name) => {
        check();
        job.stage = name;
      },
      applied: (stage, ids = {}) => {
        job.completed_stages.push(stage);
        Object.assign(job.known_ids, ids);
        job.effects = Effects.Partial;
      },
    };

    return context;
  }

  private execute(job: Job, run: (context: JobContext) => Promise<Record<string, unknown>>): void {
    job.task = Promise.resolve()
      .then(() => run(this.jobContext(job)))
      .then(
        (value) => {
          job.result = value;
          job.state = JobState.Succeeded;
          job.effects = Effects.Applied;
        },
        (error) => {
          job.error = safeError(error, job.operation);
          job.state = job.controller.signal.aborted ? JobState.Cancelled : JobState.Failed;

          if (job.error.effects === Effects.Unknown) {
            job.effects = Effects.Unknown;
          }
        },
      )
      .finally(() => {
        job.finished_at = Date.now();

        try {
          this.onTerminal(job.operation, job.state);
        } catch {
          /* Telemetry must not change workflow state. */
        }

        this.prune();
      });
  }

  private createJob(identity: string, operation: string, target: string): Job {
    const job: Job = {
      operation_id: randomUUID(),
      operation,
      identity,
      target,
      state: JobState.Running,
      stage: WorkflowStage.Accepted,
      completed_stages: [],
      known_ids: {},
      effects: Effects.NotApplied,
      created_at: Date.now(),
      controller: new AbortController(),
    };

    return job;
  }
}

interface Job {
  operation_id: string;
  operation: string;
  identity: string;
  target: string;
  state: JobState;
  stage: string;
  completed_stages: string[];
  known_ids: Record<string, unknown>;
  effects: Effects;
  created_at: number;
  finished_at?: number;
  result?: Record<string, unknown>;
  error?: ReturnType<typeof safeError>;
  controller: AbortController;
  task?: Promise<void>;
}
