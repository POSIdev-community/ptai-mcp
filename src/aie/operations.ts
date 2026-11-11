import { randomUUID } from 'node:crypto';
import { AieError, safeError, type Effects } from './errors.js';
import { LIMITS } from './limits.js';

type JobState = 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled';
export interface JobContext {
  signal: AbortSignal;
  check(): void;
  stage(name: string): void;
  applied(stage: string, ids?: Record<string, unknown>): void;
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

export class Operations {
  private readonly jobs = new Map<string, Job>();
  private closing = false;

  constructor(private readonly onTerminal: (operation: string, state: JobState) => void = () => undefined) {}

  start(
    identity: string,
    operation: string,
    target: string,
    run: (job: JobContext) => Promise<Record<string, unknown>>,
  ) {
    this.prune();
    const active = [...this.jobs.values()].filter((j) => !j.finished_at);
    if (this.closing || active.length >= LIMITS.maxActiveJobs)
      throw new AieError('AIE_OPERATION_BUSY', 'No workflow slot is available.', { effects: 'not_applied' });
    if (active.some((j) => j.identity === identity && j.target === target))
      throw new AieError('AIE_TARGET_BUSY', 'A workflow is already changing this target.', { effects: 'not_applied' });
    const job: Job = {
      operation_id: randomUUID(),
      operation,
      identity,
      target,
      state: 'running',
      stage: 'accepted',
      completed_stages: [],
      known_ids: {},
      effects: 'not_applied',
      created_at: Date.now(),
      controller: new AbortController(),
    };
    this.jobs.set(job.operation_id, job);
    const check = () => {
      if (job.controller.signal.aborted) throw new AieError('AIE_CANCELLED', 'Workflow cancelled.');
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
        job.effects = 'partial';
      },
    };
    job.task = Promise.resolve()
      .then(() => run(context))
      .then(
        (value) => {
          job.result = value;
          job.state = 'succeeded';
          job.effects = 'applied';
        },
        (error) => {
          job.error = safeError(error, operation);
          job.state = job.controller.signal.aborted ? 'cancelled' : 'failed';
          if (job.error.effects === 'unknown') job.effects = 'unknown';
        },
      )
      .finally(() => {
        job.finished_at = Date.now();
        try {
          this.onTerminal(operation, job.state);
        } catch {
          /* Telemetry must not change workflow state. */
        }
        this.prune();
      });
    return this.view(job);
  }

  get(identity: string, id: string) {
    this.prune();
    return this.view(this.find(identity, id));
  }
  isBusy(identity: string, target: string) {
    return [...this.jobs.values()].some(
      (job) => job.identity === identity && job.target === target && !job.finished_at,
    );
  }
  cancel(identity: string, id: string) {
    const job = this.find(identity, id);
    if (!job.finished_at) {
      job.state = 'cancelling';
      job.controller.abort();
    }
    return this.view(job);
  }
  cancelIdentity(identity: string) {
    for (const job of this.jobs.values())
      if (job.identity === identity && !job.finished_at) {
        job.state = 'cancelling';
        job.controller.abort();
      }
  }
  async close() {
    this.closing = true;
    for (const job of this.jobs.values()) if (!job.finished_at) job.controller.abort();
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
    if (!job)
      throw new AieError(
        'AIE_OPERATION_NOT_FOUND',
        'Operation was lost after restart, expired, or does not exist. Inspect AIE using the known IDs before repeating a change.',
      );
    if (job.identity !== identity)
      throw new AieError('AIE_CONTEXT_CHANGED', 'Operation belongs to another server or user.');
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
    for (const [index, job] of terminal.entries())
      if (job.finished_at! + LIMITS.jobTtlMs <= Date.now() || index < terminal.length - LIMITS.maxTerminalJobs)
        this.jobs.delete(job.operation_id);
  }
}
